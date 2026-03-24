import assert from "node:assert/strict"
import test from "node:test"

import { getOpsOrganizationDetail } from "../../models/ops-organization-detail.ts"

test("getOpsOrganizationDetail agrega contrato, miembros, invitaciones, soporte y auditoría", async () => {
  const detail = await getOpsOrganizationDetail("org-1", {
    getOrganizationSnapshot: async () => ({
      id: "org-1",
      name: "Acme SL",
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
      subscription: {
        planCode: "starter",
        catalogVersion: 1,
        billingStatus: "active",
        accessStatus: "enabled",
        currentPeriodEndsAt: new Date("2026-04-01T00:00:00.000Z"),
        scheduledPlanCode: "pro",
        scheduledCatalogVersion: 1,
        addons: [{ addonCode: "tax", isActive: true, expiresAt: null, scheduledRemovalAt: null }],
      },
      memberships: [
        {
          id: "m-1",
          userId: "user-1",
          role: "owner",
          user: {
            id: "user-1",
            email: "owner@example.com",
            name: "Owner",
            businessAddress: "Calle Mayor 1",
          },
        },
      ],
      invitations: [{ id: "inv-1", email: "pending@example.com", role: "member", token: "tok", expiresAt: new Date(), revokedAt: null, acceptedAt: null }],
      usageRecords: [{ metricKey: "storage.bytes", quantity: 1024, periodKey: "current" }],
      activeOverrides: [{ id: "ov-1", type: "access_status", key: "global", accessStatusValue: "restricted", expiresAt: null }],
      hasUnsortedBacklog: true,
    }),
    getAttentionSummary: async () => ({
      readiness: {
        isReady: false,
        completedCount: 3,
        totalCount: 4,
        nextStep: { key: "backups", title: "Activa backups", href: "/settings/backups" },
      },
      counts: { needsAction: 4, blocked: 1 },
      topItem: { title: "Revisa fiscal", href: "/tax/review" },
      items: [],
    }),
    listSupportAccessSessions: async () => [
      {
        id: "session-1",
        organizationId: "org-1",
        userId: "support-1",
        mode: "read_only",
        reason: "Diagnóstico",
        expiresAt: new Date("2026-03-24T10:00:00.000Z"),
        revokedAt: null,
        user: { email: "support@example.com", name: "Support" },
        organization: { name: "Acme SL" },
      },
    ],
    listRecentPlatformAuditLogs: async () => [
      {
        id: "audit-1",
        organizationId: "org-1",
        action: "support_access.created",
        reason: "Diagnóstico",
        createdAt: new Date("2026-03-23T12:00:00.000Z"),
      },
    ],
    listRecentBillingEventsByOrganization: async () => [
      {
        id: "billing-1",
        eventType: "checkout.session.completed",
        externalEventId: "evt_1",
        processedAt: new Date("2026-03-23T12:05:00.000Z"),
        createdAt: new Date("2026-03-23T12:04:00.000Z"),
      },
    ],
  })

  assert.equal(detail.organization.name, "Acme SL")
  assert.equal(detail.contract?.scheduledPlanCode, "pro")
  assert.equal(detail.members.length, 1)
  assert.equal(detail.invitations.length, 1)
  assert.equal(detail.support.activeSessions.length, 1)
  assert.equal(detail.audit.recentLogs.length, 1)
  assert.equal(detail.audit.recentBillingEvents.length, 1)
  assert.equal(detail.health.blockers[0].title, "Revisa fiscal")
  assert.equal(detail.flags.hasUnsortedBacklog, true)
  assert.equal(detail.flags.hasActiveAccessOverride, true)
})

test("getOpsOrganizationDetail devuelve null si la organización no existe", async () => {
  const detail = await getOpsOrganizationDetail("missing-org", {
    getOrganizationSnapshot: async () => null,
  })

  assert.equal(detail, null)
})
