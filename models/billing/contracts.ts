import type { AccessStatus, BillingStatus, Prisma } from "../../prisma/client/index.js"

type OrganizationSubscriptionAddonRecord = {
  addonCode: string
  isActive: boolean
  expiresAt: Date | null
}

export type OrganizationContractRecord = {
  id: string
  organizationId: string
  planCode: string
  catalogVersion: number
  billingStatus: BillingStatus
  accessStatus: AccessStatus
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  lastStripeEventId?: string | null
  lastStripeEventCreatedAt?: Date | null
  currentPeriodStartsAt: Date | null
  currentPeriodEndsAt: Date | null
  gracePeriodEndsAt: Date | null
  scheduledPlanCode: string | null
  scheduledCatalogVersion: number | null
  cancelAtPeriodEnd: boolean
  addons?: OrganizationSubscriptionAddonRecord[]
}

type ContractStoreTransaction = {
  organizationSubscription: {
    findUnique: (args: {
      where: {
        organizationId: string
      }
      include?: {
        addons: true
      }
    }) => Promise<OrganizationContractRecord | null>
    findFirst: (args: {
      where: {
        stripeCustomerId?: string
        stripeSubscriptionId?: string
      }
      include?: {
        addons: true
      }
    }) => Promise<OrganizationContractRecord | null>
    upsert: (args: {
      where: {
        organizationId: string
      }
      update: Prisma.OrganizationSubscriptionUncheckedUpdateInput
      create: Prisma.OrganizationSubscriptionUncheckedCreateInput
    }) => Promise<OrganizationContractRecord>
    update: (args: {
      where: {
        organizationId: string
      }
      data: Prisma.OrganizationSubscriptionUncheckedUpdateInput
    }) => Promise<OrganizationContractRecord>
  }
  organizationSubscriptionAddon: {
    deleteMany: (args: {
      where: {
        subscriptionId: string
      }
    }) => Promise<unknown>
    createMany: (args: {
      data: Array<{
        subscriptionId: string
        addonCode: string
        catalogVersion: number
        isActive: boolean
      }>
    }) => Promise<{ count: number }>
  }
}

type ContractStore = ContractStoreTransaction & {
  $transaction?: <T>(callback: (tx: ContractStoreTransaction) => Promise<T>) => Promise<T>
}

export function mapStripeSubscriptionStatus(status: string): {
  billingStatus: `${BillingStatus}`
  accessStatus: `${AccessStatus}`
} {
  switch (status) {
    case "trialing":
      return { billingStatus: "trial", accessStatus: "enabled" }
    case "active":
      return { billingStatus: "active", accessStatus: "enabled" }
    case "past_due":
      return { billingStatus: "past_due", accessStatus: "grace_period" }
    case "unpaid":
      return { billingStatus: "past_due", accessStatus: "restricted" }
    case "canceled":
    case "incomplete_expired":
      return { billingStatus: "cancelled", accessStatus: "restricted" }
    default:
      return { billingStatus: "past_due", accessStatus: "restricted" }
  }
}

export async function getOrganizationContract(organizationId: string, store?: ContractStore) {
  const db = await resolveStore(store)

  return await db.organizationSubscription.findUnique({
    where: { organizationId },
    include: { addons: true },
  })
}

export async function findOrganizationContractByStripeCustomerId(customerId: string, store?: ContractStore) {
  const db = await resolveStore(store)

  return await db.organizationSubscription.findFirst({
    where: { stripeCustomerId: customerId },
    include: { addons: true },
  })
}

export async function syncOrganizationSubscriptionContract(
  input: {
    organizationId: string
    planCode: string
    catalogVersion: number
    billingStatus: `${BillingStatus}`
    accessStatus: `${AccessStatus}`
    stripeCustomerId?: string | null
    stripeSubscriptionId?: string | null
    stripeEventId?: string | null
    stripeEventCreatedAt?: Date | null
    addonCodes?: string[]
    currentPeriodStartsAt?: Date | null
    currentPeriodEndsAt?: Date | null
    gracePeriodEndsAt?: Date | null
    scheduledPlanCode?: string | null
    scheduledCatalogVersion?: number | null
    cancelAtPeriodEnd?: boolean
  },
  store?: ContractStore
) {
  const db = await resolveStore(store)
  const execute = async (tx: ContractStoreTransaction) => {
    const existingSubscription = await tx.organizationSubscription.findUnique({
      where: { organizationId: input.organizationId },
      include: { addons: true },
    })

    if (shouldIgnoreStripeEvent(existingSubscription, input.stripeEventId, input.stripeEventCreatedAt)) {
      return existingSubscription
    }

    const subscription = await tx.organizationSubscription.upsert({
      where: { organizationId: input.organizationId },
      update: {
        planCode: input.planCode,
        catalogVersion: input.catalogVersion,
        billingStatus: input.billingStatus,
        accessStatus: input.accessStatus,
        stripeCustomerId: input.stripeCustomerId ?? undefined,
        stripeSubscriptionId: input.stripeSubscriptionId ?? undefined,
        lastStripeEventId: input.stripeEventId ?? undefined,
        lastStripeEventCreatedAt: input.stripeEventCreatedAt ?? undefined,
        currentPeriodStartsAt: input.currentPeriodStartsAt ?? undefined,
        currentPeriodEndsAt: input.currentPeriodEndsAt ?? undefined,
        gracePeriodEndsAt: input.gracePeriodEndsAt ?? undefined,
        scheduledPlanCode: input.scheduledPlanCode ?? undefined,
        scheduledCatalogVersion: input.scheduledCatalogVersion ?? undefined,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
      },
      create: {
        organizationId: input.organizationId,
        planCode: input.planCode,
        catalogVersion: input.catalogVersion,
        billingStatus: input.billingStatus,
        accessStatus: input.accessStatus,
        stripeCustomerId: input.stripeCustomerId ?? null,
        stripeSubscriptionId: input.stripeSubscriptionId ?? null,
        lastStripeEventId: input.stripeEventId ?? null,
        lastStripeEventCreatedAt: input.stripeEventCreatedAt ?? null,
        currentPeriodStartsAt: input.currentPeriodStartsAt ?? null,
        currentPeriodEndsAt: input.currentPeriodEndsAt ?? null,
        gracePeriodEndsAt: input.gracePeriodEndsAt ?? null,
        scheduledPlanCode: input.scheduledPlanCode ?? null,
        scheduledCatalogVersion: input.scheduledCatalogVersion ?? null,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
      },
    })

    await tx.organizationSubscriptionAddon.deleteMany({
      where: { subscriptionId: subscription.id },
    })

    const addonCodes = [...new Set(input.addonCodes ?? [])]
    if (addonCodes.length > 0) {
      await tx.organizationSubscriptionAddon.createMany({
        data: addonCodes.map((addonCode) => ({
          subscriptionId: subscription.id,
          addonCode,
          catalogVersion: input.catalogVersion,
          isActive: true,
        })),
      })
    }

    return subscription
  }

  if (!store && db.$transaction) {
    return await db.$transaction(execute)
  }

  return await execute(db)
}

function shouldIgnoreStripeEvent(
  existingSubscription: OrganizationContractRecord | null,
  stripeEventId?: string | null,
  stripeEventCreatedAt?: Date | null
) {
  if (!existingSubscription || !stripeEventCreatedAt) {
    return false
  }

  const lastStripeEventCreatedAt = existingSubscription.lastStripeEventCreatedAt ?? null
  if (!lastStripeEventCreatedAt) {
    return false
  }

  const incomingTimestamp = stripeEventCreatedAt.getTime()
  const currentTimestamp = lastStripeEventCreatedAt.getTime()

  if (incomingTimestamp < currentTimestamp) {
    return true
  }

  if (incomingTimestamp > currentTimestamp) {
    return false
  }

  if (stripeEventId && existingSubscription.lastStripeEventId) {
    return stripeEventId !== existingSubscription.lastStripeEventId
  }

  return true
}

async function resolveStore(store?: ContractStore): Promise<ContractStore> {
  if (store) {
    return store
  }

  const { prisma } = await import("../../lib/db.ts")
  return prisma as unknown as ContractStore
}
