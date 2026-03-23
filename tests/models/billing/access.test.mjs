import assert from "node:assert/strict"
import test from "node:test"

import {
  buildOrganizationAccess,
  canUseResolvedCapability,
  getResolvedLimit,
  getResolvedUsage,
} from "../../../models/billing/access.ts"

test("buildOrganizationAccess resuelve plan base, addons y uso actual", () => {
  const access = buildOrganizationAccess({
    organizationId: "org-1",
    planCode: "early",
    billingStatus: "active",
    accessStatus: "enabled",
    addonCodes: ["ai_plus"],
    usage: {
      "ai.jobs.monthly": 120,
      "storage.bytes": 2048,
    },
  })

  assert.equal(access.plan.code, "early")
  assert.equal(access.accessStatus, "enabled")
  assert.equal(canUseResolvedCapability(access, "documents.ai_analysis"), true)
  assert.equal(getResolvedLimit(access, "ai.jobs.monthly"), 4000)
  assert.equal(getResolvedUsage(access, "ai.jobs.monthly"), 120)
})

test("buildOrganizationAccess aplica capability override y access_status override", () => {
  const access = buildOrganizationAccess({
    organizationId: "org-1",
    planCode: "early",
    billingStatus: "active",
    accessStatus: "enabled",
    addonCodes: ["tax"],
    overrides: [
      {
        type: "capability",
        key: "tax.workspace",
        boolValue: false,
      },
      {
        type: "access_status",
        key: "global",
        accessStatusValue: "restricted",
      },
    ],
  })

  assert.equal(access.accessStatus, "restricted")
  assert.equal(canUseResolvedCapability(access, "tax.workspace"), false)
  assert.equal(canUseResolvedCapability(access, "transactions.workspace"), false)
})

test("buildOrganizationAccess respeta el bypass self-hosted", () => {
  const access = buildOrganizationAccess({
    organizationId: "org-1",
    planCode: "starter",
    billingStatus: "past_due",
    accessStatus: "suspended",
    selfHostedBypass: true,
  })

  assert.equal(access.plan.code, "unlimited")
  assert.equal(access.accessStatus, "enabled")
  assert.equal(getResolvedLimit(access, "storage.bytes"), -1)
  assert.equal(canUseResolvedCapability(access, "tax.filing"), true)
})
