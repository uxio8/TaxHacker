import assert from "node:assert/strict"
import test from "node:test"

import { listOrganizationsForOps, setOrganizationAccessOverride } from "../../models/ops.ts"

function createStore(overrides = {}) {
  const baseStore = {
    organization: {
      findMany: async () => [],
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

test("listOrganizationsForOps aplica búsqueda por nombre/email", async () => {
  const calls = []

  await listOrganizationsForOps(
    { search: "acme" },
    createStore({
      organization: {
        findMany: async (args) => {
          calls.push(args)
          return []
        },
      },
    })
  )

  assert.equal(calls[0].where.OR.length, 2)
})

test("setOrganizationAccessOverride limpia el override previo y crea el nuevo si hace falta", async () => {
  const calls = []

  await setOrganizationAccessOverride(
    {
      organizationId: "org-1",
      actorUserId: "user-1",
      accessStatus: "suspended",
      reason: "Incidencia grave",
    },
    createStore({
      organization: {
        findMany: async () => [],
      },
      organizationOverride: {
        deleteMany: async (args) => {
          calls.push(["deleteMany", args])
          return null
        },
        create: async (args) => {
          calls.push(["create", args])
          return null
        },
      },
    })
  )

  assert.equal(calls[0][0], "deleteMany")
  assert.equal(calls[1][0], "create")
  assert.equal(calls[1][1].data.accessStatusValue, "suspended")
})
