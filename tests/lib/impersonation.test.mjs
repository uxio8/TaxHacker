import assert from "node:assert/strict"
import test from "node:test"

import {
  buildPlatformImpersonationCookieValue,
  resolvePlatformImpersonation,
} from "../../lib/impersonation.ts"

test("resolvePlatformImpersonation devuelve el usuario efectivo y fija la organización asumida", async () => {
  const cookieValue = await buildPlatformImpersonationCookieValue(
    {
      actorUserId: "platform-admin-1",
      sessionId: "support-session-1",
    },
    "0123456789abcdef0123456789abcdef"
  )

  const impersonation = await resolvePlatformImpersonation(
    {
      actorUserId: "platform-admin-1",
      cookieValue,
    },
    {
      authSecret: "0123456789abcdef0123456789abcdef",
      getActiveSupportAccessSessionByIdForUser: async ({ sessionId, userId }) => ({
        id: sessionId,
        userId,
        organizationId: "org-1",
        assumedUserId: "target-user-1",
        mode: "read_write",
        reason: "Soporte",
        expiresAt: new Date("2026-03-23T18:00:00.000Z"),
        revokedAt: null,
      }),
      getUserById: async (userId) => ({
        id: userId,
        email: "owner@cliente.com",
        name: "Owner Cliente",
        defaultOrganizationId: "org-persisted",
      }),
    }
  )

  assert.equal(impersonation?.effectiveUser.id, "target-user-1")
  assert.equal(impersonation?.effectiveUser.defaultOrganizationId, "org-1")
  assert.equal(impersonation?.session.mode, "read_write")
})

test("resolvePlatformImpersonation devuelve null si la cookie no es válida o la sesión no asume usuario", async () => {
  const invalidCookie = "cookie-invalida"

  const invalid = await resolvePlatformImpersonation(
    {
      actorUserId: "platform-admin-1",
      cookieValue: invalidCookie,
    },
    {
      authSecret: "0123456789abcdef0123456789abcdef",
      getActiveSupportAccessSessionByIdForUser: async () => null,
      getUserById: async () => null,
    }
  )

  assert.equal(invalid, null)

  const unsignedCookie = await buildPlatformImpersonationCookieValue(
    {
      actorUserId: "platform-admin-1",
      sessionId: "support-session-2",
    },
    "0123456789abcdef0123456789abcdef"
  )

  const noAssumedUser = await resolvePlatformImpersonation(
    {
      actorUserId: "platform-admin-1",
      cookieValue: unsignedCookie,
    },
    {
      authSecret: "0123456789abcdef0123456789abcdef",
      getActiveSupportAccessSessionByIdForUser: async ({ sessionId, userId }) => ({
        id: sessionId,
        userId,
        organizationId: "org-1",
        assumedUserId: null,
        mode: "read_only",
        reason: "Soporte",
        expiresAt: new Date("2026-03-23T18:00:00.000Z"),
        revokedAt: null,
      }),
      getUserById: async () => null,
    }
  )

  assert.equal(noAssumedUser, null)
})
