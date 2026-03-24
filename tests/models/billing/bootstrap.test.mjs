import assert from "node:assert/strict"
import test from "node:test"

import { ensureOrganizationBillingBootstrapForUser } from "../../../models/billing/bootstrap.ts"

function createStore(overrides = {}) {
  const baseStore = {
    $transaction: async (callback) => callback(baseStore),
    organizationSubscription: {
      findUnique: async () => null,
      upsert: async () => ({ id: "sub-1" }),
    },
    organizationSubscriptionAddon: {
      deleteMany: async () => null,
      createMany: async () => ({ count: 0 }),
    },
    organizationUsage: {
      upsert: async () => null,
    },
    organizationOverride: {
      deleteMany: async () => null,
      create: async () => null,
    },
  }

  return {
    ...baseStore,
    ...overrides,
  }
}

test("ensureOrganizationBillingBootstrapForUser crea contrato, uso y overrides desde billing legacy", async () => {
  const calls = []

  const contract = await ensureOrganizationBillingBootstrapForUser(
    {
      id: "user-1",
      defaultOrganizationId: "org-1",
      membershipPlan: "starter",
      membershipExpiresAt: new Date("2026-04-01T00:00:00.000Z"),
      stripeCustomerId: "cus_123",
      storageLimit: 9_999,
      storageUsed: 512,
      aiBalance: 77,
    },
    "org-1",
    createStore({
      organizationSubscription: {
        findUnique: async () => null,
        upsert: async (args) => {
          calls.push(["subscription.upsert", args])
          return { id: "sub-1" }
        },
      },
      organizationSubscriptionAddon: {
        deleteMany: async (args) => {
          calls.push(["addons.deleteMany", args])
          return null
        },
        createMany: async (args) => {
          calls.push(["addons.createMany", args])
          return { count: args.data.length }
        },
      },
      organizationUsage: {
        upsert: async (args) => {
          calls.push(["usage.upsert", args])
          return null
        },
      },
      organizationOverride: {
        deleteMany: async (args) => {
          calls.push(["override.deleteMany", args])
          return null
        },
        create: async (args) => {
          calls.push(["override.create", args])
          return null
        },
      },
    })
  )

  assert.deepEqual(contract, { id: "sub-1" })
  assert.equal(calls[0][0], "subscription.upsert")
  assert.equal(calls.some(([name]) => name === "usage.upsert"), true)
  assert.equal(calls.some(([name, args]) => name === "override.create" && args.data.key === "storage.bytes"), true)
  assert.equal(calls.some(([name, args]) => name === "override.create" && args.data.key === "ai.jobs.monthly"), true)
})

test("ensureOrganizationBillingBootstrapForUser no reescribe si el contrato ya existe", async () => {
  let writes = 0

  const contract = await ensureOrganizationBillingBootstrapForUser(
    {
      id: "user-1",
      defaultOrganizationId: "org-1",
      membershipPlan: "starter",
      membershipExpiresAt: null,
      stripeCustomerId: null,
      storageLimit: 100,
      storageUsed: 50,
      aiBalance: 10,
    },
    "org-1",
    createStore({
      organizationSubscription: {
        findUnique: async () => ({ id: "sub-existing" }),
        upsert: async () => {
          writes += 1
          return { id: "sub-existing" }
        },
      },
      organizationUsage: {
        upsert: async () => {
          writes += 1
          return null
        },
      },
      organizationOverride: {
        deleteMany: async () => {
          writes += 1
          return null
        },
        create: async () => {
          writes += 1
          return null
        },
      },
    })
  )

  assert.deepEqual(contract, { id: "sub-existing" })
  assert.equal(writes, 0)
})
