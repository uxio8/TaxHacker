import assert from "node:assert/strict"
import test from "node:test"

import { backfillOrganizationBillingFromLegacyUsers } from "../../../models/billing/backfill.ts"

function createStore(users, existingOrganizations = new Set()) {
  const calls = []
  const store = {
    user: {
      findMany: async () => users,
    },
    organizationSubscription: {
      findUnique: async ({ where }) => (existingOrganizations.has(where.organizationId) ? { id: "sub-existing" } : null),
      upsert: async (args) => {
        calls.push(["subscription.upsert", args])
        return { id: "sub-new" }
      },
    },
    organizationSubscriptionAddon: {
      deleteMany: async () => null,
      createMany: async () => ({ count: 0 }),
    },
    organizationUsage: {
      upsert: async (args) => {
        calls.push(["usage.upsert", args])
        return null
      },
    },
    $transaction: async (callback) => callback(store),
  }

  return {
    calls,
    store,
  }
}

test("backfillOrganizationBillingFromLegacyUsers crea contrato y uso inicial desde User legacy", async () => {
  const { store, calls } = createStore([
    {
      id: "user-1",
      defaultOrganizationId: "org-1",
      membershipPlan: "early",
      membershipExpiresAt: new Date("2026-04-01T00:00:00.000Z"),
      stripeCustomerId: "cus_123",
      storageUsed: 2048,
      aiBalance: 900,
    },
  ])

  const result = await backfillOrganizationBillingFromLegacyUsers({
    now: new Date("2026-03-23T00:00:00.000Z"),
    store,
  })

  assert.deepEqual(result, {
    scannedUsers: 1,
    createdContracts: 1,
    skippedContracts: 0,
  })
  assert.equal(calls[0][0], "subscription.upsert")
  assert.equal(calls[0][1].create.organizationId, "org-1")
  assert.equal(calls[0][1].create.planCode, "early")
  assert.equal(calls[0][1].create.billingStatus, "active")
  assert.equal(calls[1][1].create.metricKey, "storage.bytes")
  assert.equal(calls[1][1].create.quantity, 2048)
  assert.equal(calls[2][1].create.metricKey, "ai.jobs.monthly")
  assert.equal(calls[2][1].create.quantity, 100)
})

test("backfillOrganizationBillingFromLegacyUsers salta organizaciones con contrato existente", async () => {
  const { store } = createStore(
    [
      {
        id: "user-2",
        defaultOrganizationId: "org-existing",
        membershipPlan: "early",
        membershipExpiresAt: null,
        stripeCustomerId: null,
        storageUsed: 0,
        aiBalance: 1000,
      },
    ],
    new Set(["org-existing"])
  )

  const result = await backfillOrganizationBillingFromLegacyUsers({
    now: new Date("2026-03-23T00:00:00.000Z"),
    store,
  })

  assert.deepEqual(result, {
    scannedUsers: 1,
    createdContracts: 0,
    skippedContracts: 1,
  })
})
