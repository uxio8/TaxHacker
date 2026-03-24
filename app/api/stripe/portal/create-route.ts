import { NextResponse } from "next/server.js"

type StripePortalUser = {
  id: string
  email: string
  defaultOrganizationId: string | null
}

type StripePortalOrganization = {
  id: string
  name: string
}

type StripePortalMembership = {
  role: string
}

type StripePortalContract = {
  stripeCustomerId: string | null
} | null

type StripePortalClient = {
  billingPortal: {
    sessions: {
      create: (input: {
        customer: string
        return_url: string
      }) => Promise<{
        url: string
      }>
    }
  }
} | null

type StripePortalRouteDependencies = {
  getCurrentUser?: () => Promise<StripePortalUser>
  requireCurrentOrganization?: (dependencies: {
    getCurrentUser: () => Promise<StripePortalUser>
  }) => Promise<StripePortalOrganization>
  requireCurrentTenantAdmin?: (dependencies: {
    getCurrentUser: () => Promise<StripePortalUser>
  }) => Promise<StripePortalMembership>
  getOrganizationContract?: (organizationId: string) => Promise<StripePortalContract>
  stripeClient?: StripePortalClient
  consoleError?: (message: string, error: unknown) => void
}

async function resolveDependencies(dependencies: StripePortalRouteDependencies = {}) {
  const [authModule, tenantModule, contractsModule, stripeModule] = await Promise.all([
    dependencies.getCurrentUser ? null : import("../../../../lib/auth.ts"),
    dependencies.requireCurrentOrganization && dependencies.requireCurrentTenantAdmin
      ? null
      : import("../../../../lib/tenant.ts"),
    dependencies.getOrganizationContract ? null : import("../../../../models/billing/contracts.ts"),
    dependencies.stripeClient ? null : import("../../../../lib/stripe.ts"),
  ])

  return {
    getCurrentUser: dependencies.getCurrentUser ?? authModule!.getCurrentUser,
    requireCurrentOrganization: dependencies.requireCurrentOrganization ?? tenantModule!.requireCurrentOrganization,
    requireCurrentTenantAdmin: dependencies.requireCurrentTenantAdmin ?? tenantModule!.requireCurrentTenantAdmin,
    getOrganizationContract: dependencies.getOrganizationContract ?? contractsModule!.getOrganizationContract,
    stripeClient: dependencies.stripeClient ?? stripeModule!.stripeClient,
    consoleError: dependencies.consoleError ?? console.error,
  }
}

function isBillingAccessDenied(error: unknown) {
  return error instanceof Error && error.message === "No tienes permisos para esta acción"
}

export function createStripePortalRoute(dependencies: StripePortalRouteDependencies = {}) {
  return async function GET(request: Request) {
    const deps = await resolveDependencies(dependencies)
    const user = await deps.getCurrentUser()

    if (!deps.stripeClient) {
      return new NextResponse("Stripe client is not initialized", { status: 500 })
    }

    try {
      await deps.requireCurrentTenantAdmin({
        getCurrentUser: async () => user,
      })
      const organization = await deps.requireCurrentOrganization({
        getCurrentUser: async () => user,
      })
      const contract = await deps.getOrganizationContract(organization.id)

      if (!contract?.stripeCustomerId) {
        return NextResponse.json({ error: "No hay customer de Stripe para la organización activa" }, { status: 400 })
      }

      const { origin } = new URL(request.url)
      const portalSession = await deps.stripeClient.billingPortal.sessions.create({
        customer: contract.stripeCustomerId,
        return_url: `${origin}/settings/billing`,
      })

      return NextResponse.redirect(portalSession.url)
    } catch (error) {
      if (isBillingAccessDenied(error)) {
        return NextResponse.json(
          { error: "No tienes permisos para gestionar la facturación de esta empresa" },
          { status: 403 }
        )
      }

      deps.consoleError("Stripe portal error:", error)
      return NextResponse.json({ error: "Failed to create Stripe portal session" }, { status: 500 })
    }
  }
}
