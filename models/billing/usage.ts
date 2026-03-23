export const CURRENT_USAGE_PERIOD_KEY = "current"
export const STORAGE_USAGE_METRIC_KEY = "storage.bytes"
export const AI_USAGE_METRIC_KEY = "ai.jobs.monthly"

type UsageStore = {
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
    findMany: (args: {
      where: {
        organizationId: string
      }
    }) => Promise<
      Array<{
        metricKey: string
        periodKey: string
        quantity: number
      }>
    >
  }
}

export function getCurrentMonthlyUsagePeriodKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

export async function setOrganizationUsage(
  input: {
    organizationId: string
    metricKey: string
    periodKey: string
    quantity: number
  },
  store?: UsageStore
) {
  const db = await resolveStore(store)

  await db.organizationUsage.upsert({
    where: {
      organizationId_metricKey_periodKey: {
        organizationId: input.organizationId,
        metricKey: input.metricKey,
        periodKey: input.periodKey,
      },
    },
    update: {
      quantity: input.quantity,
    },
    create: {
      organizationId: input.organizationId,
      metricKey: input.metricKey,
      periodKey: input.periodKey,
      quantity: input.quantity,
    },
  })
}

export async function incrementOrganizationUsage(
  input: {
    organizationId: string
    metricKey: string
    periodKey: string
    amount?: number
  },
  store?: UsageStore
) {
  const db = await resolveStore(store)
  const amount = input.amount ?? 1

  await db.organizationUsage.upsert({
    where: {
      organizationId_metricKey_periodKey: {
        organizationId: input.organizationId,
        metricKey: input.metricKey,
        periodKey: input.periodKey,
      },
    },
    update: {
      quantity: {
        increment: amount,
      },
    },
    create: {
      organizationId: input.organizationId,
      metricKey: input.metricKey,
      periodKey: input.periodKey,
      quantity: amount,
    },
  })
}

export async function listOrganizationUsage(organizationId: string, store?: UsageStore) {
  const db = await resolveStore(store)
  return await db.organizationUsage.findMany({
    where: { organizationId },
  })
}

export async function syncOrganizationStorageUsageSnapshot(
  input: {
    organizationId: string
    userId?: string | null
    userEmailOrId?: string | null
    quantity?: number
  },
  dependencies: {
    getTenantStorageUsed?: (input: {
      organizationId: string
      userEmailOrId?: string | null
    }) => Promise<number>
    store?: UsageStore
  } = {}
) {
  const quantity =
    typeof input.quantity === "number"
      ? input.quantity
      : await (
        dependencies.getTenantStorageUsed
        || (async (storageInput: { organizationId: string; userEmailOrId?: string | null }) => {
          const { getTenantStorageUsed } = await import("../../lib/files.ts")
          return getTenantStorageUsed(storageInput)
        })
      )({
        organizationId: input.organizationId,
        userEmailOrId: input.userEmailOrId,
      })

  await setOrganizationUsage(
    {
      organizationId: input.organizationId,
      metricKey: STORAGE_USAGE_METRIC_KEY,
      periodKey: CURRENT_USAGE_PERIOD_KEY,
      quantity,
    },
    dependencies.store
  )

  return quantity
}

async function resolveStore(store?: UsageStore): Promise<UsageStore> {
  if (store) {
    return store
  }

  const { prisma } = await import("../../lib/db.ts")
  return prisma as unknown as UsageStore
}
