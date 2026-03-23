import assert from "node:assert/strict"
import test from "node:test"

import { createPlatformAuditLog, listRecentPlatformAuditLogs } from "../../models/platform-audit.ts"

function createStore(overrides = {}) {
  const baseStore = {
    platformAuditLog: {
      create: async () => null,
      findMany: async () => [],
    },
  }

  return {
    ...baseStore,
    ...overrides,
  }
}

test("createPlatformAuditLog persiste actor, organización y payload", async () => {
  const calls = []

  await createPlatformAuditLog(
    {
      action: "support_access.created",
      actorUserId: "user-1",
      organizationId: "org-1",
      reason: "Soporte",
      payload: { mode: "read_only" },
    },
    createStore({
      platformAuditLog: {
        create: async (args) => {
          calls.push(args)
          return null
        },
        findMany: async () => [],
      },
    })
  )

  assert.equal(calls.length, 1)
  assert.equal(calls[0].data.action, "support_access.created")
  assert.equal(calls[0].data.organizationId, "org-1")
})

test("listRecentPlatformAuditLogs aplica filtros y límite", async () => {
  const calls = []

  await listRecentPlatformAuditLogs(
    {
      organizationId: "org-1",
      actorUserId: "user-1",
      limit: 5,
    },
    createStore({
      platformAuditLog: {
        create: async () => null,
        findMany: async (args) => {
          calls.push(args)
          return []
        },
      },
    })
  )

  assert.deepEqual(calls, [
    {
      where: {
        organizationId: "org-1",
        actorUserId: "user-1",
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    },
  ])
})
