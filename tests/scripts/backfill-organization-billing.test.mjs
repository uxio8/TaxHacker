import assert from "node:assert/strict"
import test from "node:test"

import {
  isExecutedAsScript,
  runOrganizationBillingBackfill,
} from "../../scripts/backfill-organization-billing.ts"

test("runOrganizationBillingBackfill cuenta elegibles y respeta dry-run", async () => {
  const calls = []

  const report = await runOrganizationBillingBackfill(
    { dryRun: true },
    {
      listUsers: async () => [
        {
          id: "user-1",
          email: "owner@example.com",
          defaultOrganizationId: "org-1",
          membershipPlan: "starter",
          membershipExpiresAt: null,
          stripeCustomerId: null,
          storageLimit: 100,
          storageUsed: 50,
          aiBalance: 10,
        },
        {
          id: "user-2",
          email: "selfhosted@example.com",
          defaultOrganizationId: "org-2",
          membershipPlan: "unlimited",
          membershipExpiresAt: null,
          stripeCustomerId: null,
          storageLimit: -1,
          storageUsed: 0,
          aiBalance: -1,
        },
      ],
      ensureBillingBootstrap: async (...args) => {
        calls.push(args)
      },
    }
  )

  assert.deepEqual(report, {
    scanned: 2,
    eligible: 1,
    bootstrapped: 0,
    skipped: 1,
  })
  assert.equal(calls.length, 0)
})

test("runOrganizationBillingBackfill ejecuta el bootstrap sobre usuarios elegibles", async () => {
  const calls = []

  const report = await runOrganizationBillingBackfill(
    {},
    {
      listUsers: async () => [
        {
          id: "user-1",
          email: "owner@example.com",
          defaultOrganizationId: "org-1",
          membershipPlan: "starter",
          membershipExpiresAt: null,
          stripeCustomerId: "cus_123",
          storageLimit: 100,
          storageUsed: 50,
          aiBalance: 10,
        },
      ],
      ensureBillingBootstrap: async (user, organizationId) => {
        calls.push([user.id, organizationId])
      },
    }
  )

  assert.deepEqual(report, {
    scanned: 1,
    eligible: 1,
    bootstrapped: 1,
    skipped: 0,
  })
  assert.deepEqual(calls, [["user-1", "org-1"]])
})

test("isExecutedAsScript soporta rutas con espacios", () => {
  assert.equal(
    isExecutedAsScript(
      "file:///Users/test/Nuevos%20desarrollos/taxhacker/scripts/backfill-organization-billing.ts",
      "/Users/test/Nuevos desarrollos/taxhacker/scripts/backfill-organization-billing.ts"
    ),
    true
  )
})
