import assert from "node:assert/strict"
import test from "node:test"

import { buildOpsOrganizationHealthSummary } from "../../models/ops-organization-detail.ts"

test("buildOpsOrganizationHealthSummary prioriza bloqueos y readiness", () => {
  const summary = buildOpsOrganizationHealthSummary({
    readiness: {
      isReady: false,
      completedCount: 2,
      totalCount: 4,
      nextStep: {
        key: "llm",
        title: "Configura IA",
        href: "/settings/llm",
      },
    },
    attention: {
      counts: {
        needsAction: 5,
        blocked: 2,
      },
      topItem: {
        title: "Bloqueo fiscal",
        href: "/tax/review",
      },
    },
    activeSupportSessions: 1,
    openInvitationCount: 2,
    billingStatus: "past_due",
    accessStatus: "grace_period",
    hasUnsortedBacklog: true,
  })

  assert.equal(summary.statusTone, "warning")
  assert.equal(summary.blockers.length, 3)
  assert.equal(summary.blockers[0].title, "Bloqueo fiscal")
  assert.equal(summary.blockers[1].href, "/settings/llm")
  assert.equal(summary.counters.blocked, 2)
  assert.equal(summary.counters.openInvitations, 2)
  assert.equal(summary.counters.supportSessions, 1)
})

test("buildOpsOrganizationHealthSummary devuelve estado healthy si no hay fricción", () => {
  const summary = buildOpsOrganizationHealthSummary({
    readiness: {
      isReady: true,
      completedCount: 4,
      totalCount: 4,
      nextStep: null,
    },
    attention: {
      counts: {
        needsAction: 0,
        blocked: 0,
      },
      topItem: null,
    },
    activeSupportSessions: 0,
    openInvitationCount: 0,
    billingStatus: "active",
    accessStatus: "enabled",
    hasUnsortedBacklog: false,
  })

  assert.equal(summary.statusTone, "healthy")
  assert.equal(summary.blockers.length, 0)
  assert.equal(summary.counters.needsAction, 0)
})
