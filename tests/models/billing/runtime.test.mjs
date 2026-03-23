import assert from "node:assert/strict"
import test from "node:test"

import {
  buildOrganizationActionUser,
  buildSidebarUserProfile,
  getLegacyBillingExpirationDate,
  isOrganizationAccessRestricted,
} from "../../../models/billing/runtime.ts"

test("buildSidebarUserProfile usa la proyección de billing resuelta por organización", () => {
  const profile = buildSidebarUserProfile(
    {
      id: "user-1",
      name: "Ada",
      email: "ada@example.com",
      avatar: "https://example.com/avatar.png",
    },
    {
      membershipPlan: "starter",
      storageUsed: 2048,
      storageLimit: 4096,
      aiBalance: 12,
    }
  )

  assert.deepEqual(profile, {
    id: "user-1",
    name: "Ada",
    email: "ada@example.com",
    avatar: "https://example.com/avatar.png",
    membershipPlan: "starter",
    storageUsed: 2048,
    storageLimit: 4096,
    aiBalance: 12,
  })
})

test("buildSidebarUserProfile conserva valores cero sin convertirlos en defaults", () => {
  const profile = buildSidebarUserProfile(
    {
      id: "user-1",
      name: null,
      email: "ada@example.com",
      avatar: null,
    },
    {
      membershipPlan: "starter",
      storageUsed: 0,
      storageLimit: 0,
      aiBalance: 0,
    }
  )

  assert.deepEqual(profile, {
    id: "user-1",
    name: "",
    email: "ada@example.com",
    avatar: undefined,
    membershipPlan: "starter",
    storageUsed: 0,
    storageLimit: 0,
    aiBalance: 0,
  })
})

test("buildOrganizationActionUser construye el payload runtime para uploads y móvil", () => {
  const runtimeUser = buildOrganizationActionUser(
    {
      id: "user-1",
      email: "ada@example.com",
    },
    {
      organizationId: "org-1",
      membershipPlan: "pro",
      storageUsed: 128,
      storageLimit: 2048,
      membershipExpiresAt: null,
      accessStatus: "grace_period",
    }
  )

  assert.deepEqual(runtimeUser, {
    id: "user-1",
    email: "ada@example.com",
    organizationId: "org-1",
    storageUsed: 128,
    storageLimit: 2048,
    membershipExpiresAt: null,
    accessStatus: "grace_period",
  })
})

test("isOrganizationAccessRestricted solo bloquea restricted y suspended", () => {
  assert.equal(isOrganizationAccessRestricted("enabled"), false)
  assert.equal(isOrganizationAccessRestricted("grace_period"), false)
  assert.equal(isOrganizationAccessRestricted("restricted"), true)
  assert.equal(isOrganizationAccessRestricted("suspended"), true)
})

test("getLegacyBillingExpirationDate solo devuelve fecha para accessStatus no bloqueado", () => {
  const periodEnd = new Date("2026-05-01T00:00:00.000Z")

  assert.equal(getLegacyBillingExpirationDate("enabled", periodEnd)?.toISOString(), periodEnd.toISOString())
  assert.equal(getLegacyBillingExpirationDate("grace_period", periodEnd)?.toISOString(), periodEnd.toISOString())
  assert.equal(getLegacyBillingExpirationDate("restricted", periodEnd)?.toISOString(), new Date(0).toISOString())
  assert.equal(getLegacyBillingExpirationDate("suspended", periodEnd)?.toISOString(), new Date(0).toISOString())
})
