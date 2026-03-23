import assert from "node:assert/strict"
import test from "node:test"

import {
  createSupportAccessSession,
  getActiveSupportAccessSession,
  getActiveSupportAccessSessionByIdForUser,
  hasActiveSupportAccess,
  listActiveSupportOrganizationsForUser,
  listSupportAccessSessions,
  revokeSupportAccessSession,
} from "../../models/support-access.ts"

function createStore(overrides = {}) {
  const baseStore = {
    supportAccessSession: {
      create: async () => null,
      update: async () => null,
      findMany: async () => [],
      findFirst: async () => null,
    },
  }

  return {
    ...baseStore,
    ...overrides,
  }
}

test("createSupportAccessSession crea una sesión temporal", async () => {
  const calls = []

  await createSupportAccessSession(
    {
      organizationId: "org-1",
      userId: "user-1",
      mode: "read_only",
      reason: "Incidencia",
      expiresAt: new Date("2026-03-23T10:00:00.000Z"),
      assumedUserId: "target-user-1",
    },
    createStore({
      supportAccessSession: {
        create: async (args) => {
          calls.push(args)
          return { id: "session-1", ...args.data, revokedAt: null }
        },
        update: async () => null,
        findMany: async () => [],
        findFirst: async () => null,
      },
    })
  )

  assert.equal(calls[0].data.mode, "read_only")
  assert.equal(calls[0].data.assumedUserId, "target-user-1")
})

test("revokeSupportAccessSession marca revokedAt", async () => {
  const calls = []

  await revokeSupportAccessSession(
    {
      sessionId: "session-1",
      revokedAt: new Date("2026-03-23T11:00:00.000Z"),
    },
    createStore({
      supportAccessSession: {
        create: async () => null,
        update: async (args) => {
          calls.push(args)
          return { id: "session-1", organizationId: "org-1", userId: "user-1", mode: "read_only", reason: "", expiresAt: new Date(), revokedAt: new Date() }
        },
        findMany: async () => [],
        findFirst: async () => null,
      },
    })
  )

  assert.equal(calls[0].where.id, "session-1")
})

test("listSupportAccessSessions aplica filtros de sesión activa", async () => {
  const calls = []

  await listSupportAccessSessions(
    {
      organizationId: "org-1",
      activeOnly: true,
      limit: 3,
    },
    createStore({
      supportAccessSession: {
        create: async () => null,
        update: async () => null,
        findMany: async (args) => {
          calls.push(args)
          return []
        },
        findFirst: async () => null,
      },
    })
  )

  assert.equal(calls[0].where.organizationId, "org-1")
  assert.equal(calls[0].take, 3)
  assert.equal(calls[0].where.revokedAt, null)
})

test("hasActiveSupportAccess detecta sesiones vigentes", async () => {
  const result = await hasActiveSupportAccess(
    {
      organizationId: "org-1",
      userId: "user-1",
    },
    createStore({
      supportAccessSession: {
        create: async () => null,
        update: async () => null,
        findMany: async () => [],
        findFirst: async () => ({ id: "session-1", organizationId: "org-1", userId: "user-1", mode: "read_only", reason: "", expiresAt: new Date(), revokedAt: null }),
      },
    })
  )

  assert.equal(result, true)
})

test("getActiveSupportAccessSession devuelve la sesión activa más reciente", async () => {
  const session = await getActiveSupportAccessSession(
    {
      organizationId: "org-1",
      userId: "user-1",
    },
    createStore({
      supportAccessSession: {
        create: async () => null,
        update: async () => null,
        findMany: async () => [],
        findFirst: async () => ({
          id: "session-1",
          organizationId: "org-1",
          userId: "user-1",
          mode: "read_write",
          reason: "",
          expiresAt: new Date(),
          revokedAt: null,
        }),
      },
    })
  )

  assert.equal(session?.mode, "read_write")
})

test("getActiveSupportAccessSessionByIdForUser devuelve una sesión activa concreta", async () => {
  const session = await getActiveSupportAccessSessionByIdForUser(
    {
      sessionId: "session-1",
      userId: "support-user",
    },
    createStore({
      supportAccessSession: {
        create: async () => null,
        update: async () => null,
        findMany: async () => [],
        findFirst: async (args) => ({
          id: args.where.id,
          organizationId: "org-1",
          userId: args.where.userId,
          mode: "read_write",
          reason: "Diagnóstico",
          expiresAt: new Date(),
          revokedAt: null,
          assumedUserId: "target-user-1",
        }),
      },
    })
  )

  assert.equal(session?.id, "session-1")
  assert.equal(session?.assumedUserId, "target-user-1")
})

test("listActiveSupportOrganizationsForUser agrupa por organización y conserva la sesión más reciente", async () => {
  const organizations = await listActiveSupportOrganizationsForUser(
    "support-user",
    createStore({
      supportAccessSession: {
        create: async () => null,
        update: async () => null,
        findFirst: async () => null,
        findMany: async () => [
          {
            id: "session-2",
            organizationId: "org-2",
            userId: "support-user",
            mode: "read_write",
            reason: "",
            expiresAt: new Date(),
            revokedAt: null,
            organization: {
              id: "org-2",
              name: "Cliente B",
            },
          },
          {
            id: "session-1",
            organizationId: "org-2",
            userId: "support-user",
            mode: "read_only",
            reason: "",
            expiresAt: new Date(),
            revokedAt: null,
            organization: {
              id: "org-2",
              name: "Cliente B",
            },
          },
          {
            id: "session-3",
            organizationId: "org-1",
            userId: "support-user",
            mode: "read_only",
            reason: "",
            expiresAt: new Date(),
            revokedAt: null,
            organization: {
              id: "org-1",
              name: "Cliente A",
            },
          },
        ],
      },
    })
  )

  assert.deepEqual(organizations, [
    {
      id: "org-2",
      name: "Cliente B",
      mode: "read_write",
    },
    {
      id: "org-1",
      name: "Cliente A",
      mode: "read_only",
    },
  ])
})
