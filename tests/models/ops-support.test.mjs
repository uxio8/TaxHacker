import assert from "node:assert/strict"
import test from "node:test"

import { buildOpsSupportTimeline, getOpsOrganizationSupport } from "../../models/ops-support.ts"

test("buildOpsSupportTimeline mezcla sesiones y auditoría en orden temporal", () => {
  const timeline = buildOpsSupportTimeline({
    sessions: [
      {
        id: "session-1",
        reason: "Diagnóstico",
        mode: "read_write",
        createdAt: new Date("2026-03-23T12:00:00.000Z"),
        expiresAt: new Date("2026-03-23T14:00:00.000Z"),
        revokedAt: null,
        user: { name: "Soporte", email: "support@example.com" },
        assumedUser: { id: "user-1", name: "Owner", email: "owner@example.com" },
      },
    ],
    auditRows: [
      {
        id: "audit-1",
        action: "support_impersonation.stopped",
        reason: "Cierre",
        createdAt: new Date("2026-03-23T13:00:00.000Z"),
        organizationId: "org-1",
      },
    ],
  })

  assert.equal(timeline[0].kind, "audit")
  assert.equal(timeline[1].kind, "session")
  assert.match(timeline[1].title, /Actuando como/i)
})

test("getOpsOrganizationSupport expone guardrails y sesiones activas", async () => {
  const support = await getOpsOrganizationSupport("org-1", {
    listSupportAccessSessions: async () => [
      {
        id: "session-1",
        organizationId: "org-1",
        userId: "support-1",
        mode: "read_only",
        reason: "Investigación",
        expiresAt: new Date("2026-03-23T15:00:00.000Z"),
        revokedAt: null,
        createdAt: new Date("2026-03-23T12:00:00.000Z"),
        user: { name: "Support", email: "support@example.com" },
        assumedUser: null,
        organization: { name: "Acme SL" },
      },
    ],
    listRecentPlatformAuditLogs: async () => [],
  })

  assert.equal(support.activeSessions.length, 1)
  assert.equal(support.guardrails.defaultDurationHours, 2)
  assert.equal(support.guardrails.maxDurationHours, 8)
})
