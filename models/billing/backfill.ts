import { getPlanDefinition } from "../../lib/billing/catalog.ts"
import { getCurrentMonthlyUsagePeriodKey, setOrganizationUsage } from "./usage.ts"
import { syncOrganizationSubscriptionContract } from "./contracts.ts"

type LegacyBillingUser = {
  id: string
  defaultOrganizationId: string | null
  membershipPlan: string | null
  membershipExpiresAt: Date | null
  stripeCustomerId: string | null
  storageUsed: number
  aiBalance: number
}

type BackfillStore = {
  user: {
    findMany: (args: {
      where: {
        defaultOrganizationId: {
          not: null
        }
      }
      select: {
        id: true
        defaultOrganizationId: true
        membershipPlan: true
        membershipExpiresAt: true
        stripeCustomerId: true
        storageUsed: true
        aiBalance: true
      }
    }) => Promise<LegacyBillingUser[]>
  }
  organizationSubscription: {
    findUnique: (args: {
      where: {
        organizationId: string
      }
      select: {
        id: true
      }
    }) => Promise<{ id: string } | null>
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
        quantity: number | { increment: number }
      }
      create: {
        organizationId: string
        metricKey: string
        periodKey: string
        quantity: number
      }
    }) => Promise<unknown>
  }
}

export async function backfillOrganizationBillingFromLegacyUsers(
  options: {
    now?: Date
    store?: BackfillStore
  } = {}
) {
  const now = options.now ?? new Date()
  const store = await resolveStore(options.store)
  const users = await store.user.findMany({
    where: {
      defaultOrganizationId: {
        not: null,
      },
    },
    select: {
      id: true,
      defaultOrganizationId: true,
      membershipPlan: true,
      membershipExpiresAt: true,
      stripeCustomerId: true,
      storageUsed: true,
      aiBalance: true,
    },
  })

  let createdContracts = 0
  let skippedContracts = 0

  for (const user of users) {
    const organizationId = user.defaultOrganizationId
    if (!organizationId) {
      continue
    }

    const existingContract = await store.organizationSubscription.findUnique({
      where: { organizationId },
      select: { id: true },
    })

    if (existingContract) {
      skippedContracts += 1
      continue
    }

    const plan = getPlanDefinition(user.membershipPlan || "early") ?? getPlanDefinition("early")
    if (!plan) {
      skippedContracts += 1
      continue
    }

    const isExpired = Boolean(user.membershipExpiresAt && user.membershipExpiresAt < now)
    const aiUsage =
      plan.limits["ai.jobs.monthly"] < 0 || user.aiBalance < 0
        ? 0
        : Math.max(plan.limits["ai.jobs.monthly"] - user.aiBalance, 0)

    await syncOrganizationSubscriptionContract(
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

    await setOrganizationUsage(
      {
        organizationId,
        metricKey: "storage.bytes",
        periodKey: "current",
        quantity: user.storageUsed || 0,
      },
      store as never
    )

    await setOrganizationUsage(
      {
        organizationId,
        metricKey: "ai.jobs.monthly",
        periodKey: getCurrentMonthlyUsagePeriodKey(now),
        quantity: aiUsage,
      },
      store as never
    )

    createdContracts += 1
  }

  return {
    scannedUsers: users.length,
    createdContracts,
    skippedContracts,
  }
}

async function resolveStore(store?: BackfillStore) {
  if (store) {
    return store
  }

  const { prisma } = await import("../../lib/db.ts")
  return prisma as unknown as BackfillStore
}
