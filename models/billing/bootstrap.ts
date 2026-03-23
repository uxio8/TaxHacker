import { getPlanDefinition } from "../../lib/billing/catalog.ts"
import type { User } from "../../prisma/client/index.js"
import { syncOrganizationSubscriptionContract } from "./contracts.ts"
import { CURRENT_USAGE_PERIOD_KEY, setOrganizationUsage } from "./usage.ts"

type BootstrapStore = {
  organizationSubscription: {
    findUnique: (args: {
      where: {
        organizationId: string
      }
    }) => Promise<{ id: string } | null>
    upsert: (args: {
      where: {
        organizationId: string
      }
      update: Record<string, unknown>
      create: Record<string, unknown>
    }) => Promise<{ id: string }>
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
    }) => Promise<unknown>
  }
  organizationUsage: {
    upsert: (args: {
      where: {
        organizationId_metricKey_periodKey: {
          organizationId: string
          metricKey: string
          periodKey: string
        }
      }
      update: {
        quantity: number
      }
      create: {
        organizationId: string
        metricKey: string
        periodKey: string
        quantity: number
      }
    }) => Promise<unknown>
  }
  organizationOverride: {
    deleteMany: (args: {
      where: {
        organizationId: string
        type: "limit"
        key: string
        reason: string
      }
    }) => Promise<unknown>
    create: (args: {
      data: {
        organizationId: string
        type: "limit"
        key: string
        numberValue: number
        reason: string
        createdByUserId: string
      }
    }) => Promise<unknown>
  }
  $transaction?: <T>(callback: (tx: BootstrapStore) => Promise<T>) => Promise<T>
}

const LEGACY_BILLING_OVERRIDE_REASON = "legacy-user-billing-bootstrap"

export async function ensureOrganizationBillingBootstrapForUser(
  user: Pick<
    User,
    | "id"
    | "defaultOrganizationId"
    | "membershipPlan"
    | "membershipExpiresAt"
    | "stripeCustomerId"
    | "storageLimit"
    | "storageUsed"
    | "aiBalance"
  >,
  organizationId: string = user.defaultOrganizationId ?? "",
  store?: BootstrapStore
) {
  if (!organizationId || user.membershipPlan === "unlimited") {
    return null
  }

  const db = await resolveStore(store)
  const existingContract = await db.organizationSubscription.findUnique({
    where: { organizationId },
  })

  if (existingContract) {
    return existingContract
  }

  const plan = getPlanDefinition(user.membershipPlan) ?? getPlanDefinition("early")
  if (!plan) {
    throw new Error("No se pudo resolver el plan legacy para el backfill de billing")
  }
  const now = new Date()
  const isExpired = user.membershipExpiresAt ? user.membershipExpiresAt < now : false

  const contract = await syncOrganizationSubscriptionContract(
    {
      organizationId,
      planCode: plan.code,
      catalogVersion: plan.version,
      billingStatus: isExpired ? "past_due" : "active",
      accessStatus: isExpired ? "restricted" : "enabled",
      stripeCustomerId: user.stripeCustomerId,
      currentPeriodEndsAt: user.membershipExpiresAt,
      gracePeriodEndsAt: isExpired ? user.membershipExpiresAt : null,
    },
    store as never
  )

  await Promise.all([
    setOrganizationUsage(
      {
        organizationId,
        metricKey: "storage.bytes",
        periodKey: CURRENT_USAGE_PERIOD_KEY,
        quantity: Math.max(user.storageUsed ?? 0, 0),
      },
      store as never
    ),
    ...resolveLegacyLimitOverrides(user, organizationId, plan.code, store),
  ])

  return contract
}

function resolveLegacyLimitOverrides(
  user: Pick<User, "id" | "storageLimit" | "aiBalance">,
  organizationId: string,
  planCode: string,
  store?: BootstrapStore
) {
  const plan = getPlanDefinition(planCode) ?? getPlanDefinition("early")
  if (!plan) {
    throw new Error("No se pudo resolver el plan del override legacy")
  }
  const writes: Array<Promise<unknown>> = []

  writes.push(writeLegacyLimitOverride({
    store,
    organizationId,
    userId: user.id,
    key: "storage.bytes",
    currentValue: user.storageLimit,
    planValue: plan.limits["storage.bytes"],
  }))

  writes.push(writeLegacyLimitOverride({
    store,
    organizationId,
    userId: user.id,
    key: "ai.jobs.monthly",
    currentValue: user.aiBalance,
    planValue: plan.limits["ai.jobs.monthly"],
  }))

  return writes
}

async function writeLegacyLimitOverride(input: {
  store?: BootstrapStore
  organizationId: string
  userId: string
  key: string
  currentValue: number
  planValue: number
}) {
  const db = await resolveStore(input.store)

  await db.organizationOverride.deleteMany({
    where: {
      organizationId: input.organizationId,
      type: "limit",
      key: input.key,
      reason: LEGACY_BILLING_OVERRIDE_REASON,
    },
  })

  if (input.currentValue === input.planValue) {
    return
  }

  await db.organizationOverride.create({
    data: {
      organizationId: input.organizationId,
      type: "limit",
      key: input.key,
      numberValue: input.currentValue,
      reason: LEGACY_BILLING_OVERRIDE_REASON,
      createdByUserId: input.userId,
    },
  })
}

async function resolveStore(store?: BootstrapStore): Promise<BootstrapStore> {
  if (store) {
    return store
  }

  const { prisma } = await import("../../lib/db.ts")
  return prisma as unknown as BootstrapStore
}
