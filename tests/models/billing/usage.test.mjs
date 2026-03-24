import assert from "node:assert/strict"
import test from "node:test"

import {
  CURRENT_USAGE_PERIOD_KEY,
  STORAGE_USAGE_METRIC_KEY,
  getCurrentMonthlyUsagePeriodKey,
  incrementOrganizationUsage,
  setOrganizationUsage,
  syncOrganizationStorageUsageSnapshot,
} from "../../../models/billing/usage.ts"

function createStore(overrides = {}) {
  return {
    organizationUsage: {
      upsert: async () => null,
      findMany: async () => [],
    },
    ...overrides,
  }
}

test("getCurrentMonthlyUsagePeriodKey devuelve YYYY-MM en UTC", () => {
  assert.equal(getCurrentMonthlyUsagePeriodKey(new Date("2026-03-23T10:00:00.000Z")), "2026-03")
})

test("setOrganizationUsage persiste el valor exacto del metric y periodo", async () => {
  const calls = []
  await setOrganizationUsage(
    {
      organizationId: "org-1",
      metricKey: "storage.bytes",
      periodKey: CURRENT_USAGE_PERIOD_KEY,
      quantity: 2048,
    },
    createStore({
      organizationUsage: {
        upsert: async (args) => {
          calls.push(args)
          return null
        },
        findMany: async () => [],
      },
    })
  )

  assert.deepEqual(calls, [
    {
      where: {
        organizationId_metricKey_periodKey: {
          organizationId: "org-1",
          metricKey: "storage.bytes",
          periodKey: CURRENT_USAGE_PERIOD_KEY,
        },
      },
      update: {
        quantity: 2048,
      },
      create: {
        organizationId: "org-1",
        metricKey: "storage.bytes",
        periodKey: CURRENT_USAGE_PERIOD_KEY,
        quantity: 2048,
      },
    },
  ])
})

test("incrementOrganizationUsage acumula sobre el valor existente", async () => {
  const calls = []
  await incrementOrganizationUsage(
    {
      organizationId: "org-1",
      metricKey: "ai.jobs.monthly",
      periodKey: "2026-03",
      amount: 1,
    },
    createStore({
      organizationUsage: {
        upsert: async (args) => {
          calls.push(args)
          return null
        },
        findMany: async () => [],
      },
    })
  )

  assert.deepEqual(calls, [
    {
      where: {
        organizationId_metricKey_periodKey: {
          organizationId: "org-1",
          metricKey: "ai.jobs.monthly",
          periodKey: "2026-03",
        },
      },
      update: {
        quantity: {
          increment: 1,
        },
      },
      create: {
        organizationId: "org-1",
        metricKey: "ai.jobs.monthly",
        periodKey: "2026-03",
        quantity: 1,
      },
    },
  ])
})

test("syncOrganizationStorageUsageSnapshot persiste el uso de storage sin escribir espejo legacy en User", async () => {
  const calls = []

  const quantity = await syncOrganizationStorageUsageSnapshot(
    {
      organizationId: "org-1",
      userId: "user-1",
      userEmailOrId: "owner@example.com",
    },
    {
      getTenantStorageUsed: async (input) => {
        calls.push(["measure", input])
        return 4096
      },
      store: createStore({
        organizationUsage: {
          upsert: async (args) => {
            calls.push(["upsert", args])
            return null
          },
          findMany: async () => [],
        },
      }),
    }
  )

  assert.equal(quantity, 4096)
  assert.deepEqual(calls, [
    ["measure", { organizationId: "org-1", userEmailOrId: "owner@example.com" }],
    [
      "upsert",
      {
        where: {
          organizationId_metricKey_periodKey: {
            organizationId: "org-1",
            metricKey: STORAGE_USAGE_METRIC_KEY,
            periodKey: CURRENT_USAGE_PERIOD_KEY,
          },
        },
        update: {
          quantity: 4096,
        },
        create: {
          organizationId: "org-1",
          metricKey: STORAGE_USAGE_METRIC_KEY,
          periodKey: CURRENT_USAGE_PERIOD_KEY,
          quantity: 4096,
        },
      },
    ],
  ])
})
