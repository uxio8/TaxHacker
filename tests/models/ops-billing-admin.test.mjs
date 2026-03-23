import assert from "node:assert/strict"
import test from "node:test"

import {
  scheduleOrganizationPlanChangeFromOps,
  setOrganizationAddonsFromOps,
  setOrganizationPlanFromOps,
} from "../../models/ops-billing-admin.ts"

function createStore(overrides = {}) {
  const baseStore = {
    organizationSubscription: {
      findUnique: async () => null,
      upsert: async () => ({ id: "sub-1", organizationId: "org-1", planCode: "starter", catalogVersion: 1 }),
      update: async () => ({ id: "sub-1", organizationId: "org-1", planCode: "starter", catalogVersion: 1 }),
    },
    organizationSubscriptionAddon: {
      deleteMany: async () => ({ count: 0 }),
      createMany: async () => ({ count: 0 }),
    },
  }

  return {
    ...baseStore,
    ...overrides,
  }
}

test("setOrganizationPlanFromOps cambia el plan y audita la acción", async () => {
  const calls = []
  const audits = []

  await setOrganizationPlanFromOps(
    {
      organizationId: "org-1",
      planCode: "pro",
      actorUserId: "platform-admin",
      reason: "Upgrade comercial",
    },
    {
      store: createStore({
        organizationSubscription: {
          findUnique: async () => ({
            id: "sub-1",
            organizationId: "org-1",
            planCode: "starter",
            catalogVersion: 1,
            billingStatus: "active",
            accessStatus: "enabled",
            currentPeriodEndsAt: null,
            addons: [],
          }),
          upsert: async () => {
            throw new Error("no debería hacer upsert si ya existe")
          },
          update: async (args) => {
            calls.push(args)
            return { id: "sub-1", ...args.data }
          },
        },
      }),
      createPlatformAuditLog: async (input) => {
        audits.push(input)
      },
    }
  )

  assert.equal(calls[0].data.planCode, "pro")
  assert.equal(calls[0].data.catalogVersion, 1)
  assert.equal(calls[0].data.scheduledPlanCode, null)
  assert.equal(audits[0].action, "organization.plan.updated")
})

test("setOrganizationAddonsFromOps limpia duplicados y reemplaza el estado activo", async () => {
  const calls = []

  await setOrganizationAddonsFromOps(
    {
      organizationId: "org-1",
      addonCodes: ["tax", "tax", "extra_users"],
      actorUserId: "platform-admin",
      reason: "Pack comercial",
      fallbackPlanCode: "starter",
    },
    {
      store: createStore({
        organizationSubscription: {
          findUnique: async () => null,
          upsert: async (args) => {
            calls.push(["upsert", args])
            return { id: "sub-1", organizationId: "org-1", planCode: "starter", catalogVersion: 1 }
          },
          update: async () => null,
        },
        organizationSubscriptionAddon: {
          deleteMany: async (args) => {
            calls.push(["deleteMany", args])
            return { count: 2 }
          },
          createMany: async (args) => {
            calls.push(["createMany", args])
            return { count: args.data.length }
          },
        },
      }),
      createPlatformAuditLog: async () => null,
    }
  )

  assert.equal(calls[0][0], "upsert")
  assert.equal(calls[1][0], "deleteMany")
  assert.deepEqual(
    calls[2][1].data.map((row) => row.addonCode),
    ["tax", "extra_users"]
  )
})

test("scheduleOrganizationPlanChangeFromOps programa el cambio futuro o lo limpia", async () => {
  const calls = []

  await scheduleOrganizationPlanChangeFromOps(
    {
      organizationId: "org-1",
      actorUserId: "platform-admin",
      reason: "Downgrade al cierre de ciclo",
      scheduledPlanCode: "starter",
    },
    {
      store: createStore({
        organizationSubscription: {
          findUnique: async () => ({
            id: "sub-1",
            organizationId: "org-1",
            planCode: "pro",
            catalogVersion: 1,
            billingStatus: "active",
            accessStatus: "enabled",
            currentPeriodEndsAt: null,
            addons: [],
          }),
          upsert: async () => null,
          update: async (args) => {
            calls.push(args)
            return { id: "sub-1", ...args.data }
          },
        },
      }),
      createPlatformAuditLog: async () => null,
    }
  )

  assert.equal(calls[0].data.scheduledPlanCode, "starter")
  assert.equal(calls[0].data.scheduledCatalogVersion, 1)
})
