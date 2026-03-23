import assert from "node:assert/strict"
import test from "node:test"

import {
  mapStripeSubscriptionStatus,
  syncOrganizationSubscriptionContract,
} from "../../../models/billing/contracts.ts"

function createStore(overrides = {}) {
  const baseStore = {
    $transaction: async (callback) => callback(baseStore),
    organizationSubscription: {
      upsert: async () => ({ id: "sub-1" }),
      findUnique: async () => null,
      findFirst: async () => null,
    },
    organizationSubscriptionAddon: {
      deleteMany: async () => null,
      createMany: async () => ({ count: 0 }),
    },
  }

  return {
    ...baseStore,
    ...overrides,
  }
}

test("mapStripeSubscriptionStatus separa billing y access", () => {
  assert.deepEqual(mapStripeSubscriptionStatus("active"), {
    billingStatus: "active",
    accessStatus: "enabled",
  })

  assert.deepEqual(mapStripeSubscriptionStatus("past_due"), {
    billingStatus: "past_due",
    accessStatus: "grace_period",
  })

  assert.deepEqual(mapStripeSubscriptionStatus("canceled"), {
    billingStatus: "cancelled",
    accessStatus: "restricted",
  })
})

test("syncOrganizationSubscriptionContract hace upsert del contrato y reemplaza addons activos", async () => {
  const calls = []
  const contract = await syncOrganizationSubscriptionContract(
    {
      organizationId: "org-1",
      planCode: "early",
      catalogVersion: 1,
      billingStatus: "active",
      accessStatus: "enabled",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
      addonCodes: ["tax", "ai_plus"],
      currentPeriodStartsAt: new Date("2026-03-01T00:00:00.000Z"),
      currentPeriodEndsAt: new Date("2026-04-01T00:00:00.000Z"),
    },
    createStore({
      organizationSubscription: {
        upsert: async (args) => {
          calls.push(["subscription.upsert", args])
          return { id: "sub-1" }
        },
        findUnique: async () => null,
        findFirst: async () => null,
      },
      organizationSubscriptionAddon: {
        deleteMany: async (args) => {
          calls.push(["addons.deleteMany", args])
          return null
        },
        createMany: async (args) => {
          calls.push(["addons.createMany", args])
          return { count: 2 }
        },
      },
    })
  )

  assert.deepEqual(contract, { id: "sub-1" })
  assert.equal(calls[0][0], "subscription.upsert")
  assert.deepEqual(calls[1], ["addons.deleteMany", { where: { subscriptionId: "sub-1" } }])
  assert.deepEqual(calls[2], [
    "addons.createMany",
    {
      data: [
        {
          subscriptionId: "sub-1",
          addonCode: "tax",
          catalogVersion: 1,
          isActive: true,
        },
        {
          subscriptionId: "sub-1",
          addonCode: "ai_plus",
          catalogVersion: 1,
          isActive: true,
        },
      ],
    },
  ])
})

test("syncOrganizationSubscriptionContract ignora un evento Stripe más antiguo que el último aplicado", async () => {
  let upsertCalled = false
  const existingContract = {
    id: "sub-1",
    organizationId: "org-1",
    planCode: "pro",
    catalogVersion: 1,
    billingStatus: "active",
    accessStatus: "enabled",
    stripeCustomerId: "cus_123",
    stripeSubscriptionId: "sub_123",
    currentPeriodStartsAt: null,
    currentPeriodEndsAt: null,
    gracePeriodEndsAt: null,
    scheduledPlanCode: null,
    scheduledCatalogVersion: null,
    cancelAtPeriodEnd: false,
    addons: [],
    lastStripeEventId: "evt_new",
    lastStripeEventCreatedAt: new Date("2026-03-23T12:00:00.000Z"),
  }

  const contract = await syncOrganizationSubscriptionContract(
    {
      organizationId: "org-1",
      planCode: "early",
      catalogVersion: 1,
      billingStatus: "past_due",
      accessStatus: "grace_period",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
      stripeEventId: "evt_old",
      stripeEventCreatedAt: new Date("2026-03-23T11:00:00.000Z"),
    },
    createStore({
      organizationSubscription: {
        upsert: async () => {
          upsertCalled = true
          return { id: "sub-1" }
        },
        findUnique: async () => existingContract,
        findFirst: async () => null,
      },
      organizationSubscriptionAddon: {
        deleteMany: async () => {
          throw new Error("no debería borrar addons para un evento obsoleto")
        },
        createMany: async () => {
          throw new Error("no debería recrear addons para un evento obsoleto")
        },
      },
    })
  )

  assert.equal(upsertCalled, false)
  assert.equal(contract, existingContract)
})
