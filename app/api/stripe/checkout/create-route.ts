import { NextResponse } from "next/server.js"

type StripeCheckoutPlan = {
  code: string
  stripePriceId: string
  isAvailable: boolean
}

type StripeCheckoutAddon = {
  code: string
  stripePriceId: string | null
  isAvailable: boolean
}

type StripeCheckoutUser = {
  id: string
  email: string
  defaultOrganizationId: string | null
}

type StripeCheckoutOrganization = {
  id: string
  name: string
}

type StripeCheckoutMembership = {
  role: string
}

type StripeCheckoutContract = {
  stripeCustomerId: string | null
  billingStatus: string
} | null

type StripeCheckoutClient = {
  checkout: {
    sessions: {
      create: (input: {
        billing_address_collection: "auto"
        line_items: Array<{
          price: string
          quantity: number
        }>
        mode: "subscription"
        automatic_tax: {
          enabled: boolean
        }
        allow_promotion_codes: boolean
        client_reference_id: string
        customer?: string
        customer_email?: string
        metadata: {
          organizationId: string
          planCode: string
          addonCodes: string
        }
        subscription_data: {
          metadata: {
            organizationId: string
            planCode: string
            addonCodes: string
          }
        }
        success_url: string
        cancel_url: string
      }, options?: {
        idempotencyKey?: string
      }) => Promise<{
        id?: string
        url?: string | null
      }>
    }
  }
} | null

type StripeCheckoutRouteDependencies = {
  getCurrentUser?: () => Promise<StripeCheckoutUser>
  requireCurrentOrganization?: (dependencies: {
    getCurrentUser: () => Promise<StripeCheckoutUser>
  }) => Promise<StripeCheckoutOrganization>
  requireCurrentTenantAdmin?: (dependencies: {
    getCurrentUser: () => Promise<StripeCheckoutUser>
  }) => Promise<StripeCheckoutMembership>
  getOrganizationContract?: (organizationId: string) => Promise<StripeCheckoutContract>
  getAddonDefinition?: (code: string) => Promise<StripeCheckoutAddon | null> | StripeCheckoutAddon | null
  stripeClient?: StripeCheckoutClient
  plans?: Record<string, StripeCheckoutPlan>
  paymentSuccessUrl?: string
  consoleError?: (error: unknown) => void
}

async function resolveDependencies(dependencies: StripeCheckoutRouteDependencies = {}) {
  const [authModule, tenantModule, contractsModule, catalogModule, stripeModule, configModule] = await Promise.all([
    dependencies.getCurrentUser ? null : import("../../../../lib/auth.ts"),
    dependencies.requireCurrentOrganization && dependencies.requireCurrentTenantAdmin
      ? null
      : import("../../../../lib/tenant.ts"),
    dependencies.getOrganizationContract ? null : import("../../../../models/billing/contracts.ts"),
    dependencies.getAddonDefinition ? null : import("../../../../lib/billing/catalog.ts"),
    dependencies.stripeClient && dependencies.plans ? null : import("../../../../lib/stripe.ts"),
    dependencies.paymentSuccessUrl ? null : import("../../../../lib/config.ts"),
  ])

  return {
    getCurrentUser: dependencies.getCurrentUser ?? authModule!.getCurrentUser,
    requireCurrentOrganization: dependencies.requireCurrentOrganization ?? tenantModule!.requireCurrentOrganization,
    requireCurrentTenantAdmin: dependencies.requireCurrentTenantAdmin ?? tenantModule!.requireCurrentTenantAdmin,
    getOrganizationContract: dependencies.getOrganizationContract ?? contractsModule!.getOrganizationContract,
    getAddonDefinition: dependencies.getAddonDefinition ?? catalogModule!.getAddonDefinition,
    stripeClient: dependencies.stripeClient ?? stripeModule!.stripeClient,
    plans: dependencies.plans ?? stripeModule!.PLANS,
    paymentSuccessUrl: dependencies.paymentSuccessUrl ?? configModule!.default.stripe.paymentSuccessUrl,
    consoleError: dependencies.consoleError ?? console.error,
  }
}

function isBillingAccessDenied(error: unknown) {
  return error instanceof Error && error.message === "No tienes permisos para esta acción"
}

export function createStripeCheckoutRoute(dependencies: StripeCheckoutRouteDependencies = {}) {
  return async function POST(request: Request) {
    const deps = await resolveDependencies(dependencies)
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get("code")
    const addonCodes = searchParams
      .getAll("addon")
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter(Boolean)
    const uniqueAddonCodes = [...new Set(addonCodes)].sort()

    if (!code) {
      return NextResponse.json({ error: "Missing plan code" }, { status: 400 })
    }

    if (!deps.stripeClient) {
      return NextResponse.json({ error: "Stripe is not enabled" }, { status: 500 })
    }

    const plan = deps.plans[code]
    if (!plan || !plan.isAvailable) {
      return NextResponse.json({ error: "Invalid or inactive plan" }, { status: 400 })
    }

    try {
      const user = await deps.getCurrentUser()
      await deps.requireCurrentTenantAdmin({
        getCurrentUser: async () => user,
      })
      const organization = await deps.requireCurrentOrganization({
        getCurrentUser: async () => user,
      })
      const contract = await deps.getOrganizationContract(organization.id)

      if (contract?.stripeCustomerId && contract.billingStatus !== "cancelled" && contract.billingStatus !== "archived") {
        return NextResponse.json(
          { error: "Esta empresa ya tiene facturacion activa. Usa el portal de cliente." },
          { status: 409 }
        )
      }

      const selectedAddons = (
        await Promise.all(uniqueAddonCodes.map((addonCode) => deps.getAddonDefinition(addonCode)))
      ).filter((addon): addon is StripeCheckoutAddon => Boolean(addon)).filter((addon) => addon.isAvailable && Boolean(addon.stripePriceId))

      const session = await deps.stripeClient.checkout.sessions.create({
        billing_address_collection: "auto",
        line_items: [
          {
            price: plan.stripePriceId,
            quantity: 1,
          },
          ...selectedAddons.map((addon) => ({
            price: addon.stripePriceId!,
            quantity: 1,
          })),
        ],
        mode: "subscription",
        automatic_tax: {
          enabled: true,
        },
        allow_promotion_codes: true,
        client_reference_id: organization.id,
        customer: contract?.stripeCustomerId ?? undefined,
        customer_email: contract?.stripeCustomerId ? undefined : user.email,
        metadata: {
          organizationId: organization.id,
          planCode: plan.code,
          addonCodes: JSON.stringify(selectedAddons.map((addon) => addon.code)),
        },
        subscription_data: {
          metadata: {
            organizationId: organization.id,
            planCode: plan.code,
            addonCodes: JSON.stringify(selectedAddons.map((addon) => addon.code)),
          },
        },
        success_url: deps.paymentSuccessUrl,
        cancel_url: `${origin}/settings/billing`,
      }, {
        idempotencyKey: `billing-checkout:${organization.id}:${plan.code}:${selectedAddons.map((addon) => addon.code).sort().join(",") || "base"}`,
      })

      if (!session.url) {
        return NextResponse.json({ error: `Failed to create checkout session: ${session}` }, { status: 500 })
      }

      return NextResponse.json({ session })
    } catch (error) {
      if (isBillingAccessDenied(error)) {
        return NextResponse.json(
          { error: "No tienes permisos para gestionar la facturación de esta empresa" },
          { status: 403 }
        )
      }

      deps.consoleError(error)
      return NextResponse.json({ error: `Failed to create checkout session: ${error}` }, { status: 500 })
    }
  }
}
