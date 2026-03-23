import type Stripe from "stripe"

import { getCatalogSkuByStripePriceId } from "../../lib/billing/catalog.ts"
import {
  findOrganizationContractByStripeCustomerId,
  mapStripeSubscriptionStatus,
  syncOrganizationSubscriptionContract,
} from "./contracts.ts"

export function extractCatalogSelectionFromPriceIds(priceIds: string[]) {
  const selection = priceIds
    .map((priceId) => getCatalogSkuByStripePriceId(priceId))
    .filter((sku): sku is NonNullable<typeof sku> => Boolean(sku))

  const plan = selection.find((sku) => sku.kind === "plan")
  const addonCodes = selection.filter((sku) => sku.kind === "addon").map((sku) => sku.code)

  return {
    planCode: plan?.code ?? null,
    addonCodes,
  }
}

export async function syncOrganizationSubscriptionFromStripeSubscription(
  subscription: Stripe.Subscription,
  options: {
    fallbackOrganizationId?: string | null
    stripeEventId?: string | null
    stripeEventCreatedAt?: Date | null
  } = {},
  dependencies: {
    findOrganizationContractByStripeCustomerId?: typeof findOrganizationContractByStripeCustomerId
    syncOrganizationSubscriptionContract?: typeof syncOrganizationSubscriptionContract
  } = {}
) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id
  const priceIds = subscription.items.data.map((item) => item.price.id)
  const selection = extractCatalogSelectionFromPriceIds(priceIds)
  const findContract =
    dependencies.findOrganizationContractByStripeCustomerId ?? findOrganizationContractByStripeCustomerId
  const syncContract = dependencies.syncOrganizationSubscriptionContract ?? syncOrganizationSubscriptionContract
  const existingContract = customerId ? await findContract(customerId) : null
  const organizationId =
    subscription.metadata?.organizationId || options.fallbackOrganizationId || existingContract?.organizationId || null

  if (!organizationId) {
    throw new Error("No se pudo resolver la organización del evento de Stripe")
  }

  const planCode = selection.planCode || existingContract?.planCode
  if (!planCode) {
    throw new Error("No se pudo resolver el plan del contrato desde Stripe")
  }

  const { billingStatus, accessStatus } = mapStripeSubscriptionStatus(subscription.status)
  const currentPeriodStartsAt = subscription.items.data[0]
    ? new Date(subscription.items.data[0].current_period_start * 1000)
    : null
  const currentPeriodEndsAt = subscription.items.data[0]
    ? new Date(subscription.items.data[0].current_period_end * 1000)
    : null

  return await syncContract({
    organizationId,
    planCode,
    catalogVersion: 1,
    billingStatus,
    accessStatus,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    stripeEventId: options.stripeEventId ?? null,
    stripeEventCreatedAt: options.stripeEventCreatedAt ?? null,
    addonCodes: selection.addonCodes,
    currentPeriodStartsAt,
    currentPeriodEndsAt,
    gracePeriodEndsAt: billingStatus === "past_due" ? currentPeriodEndsAt : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  })
}
