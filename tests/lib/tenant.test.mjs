import assert from "node:assert/strict"
import test from "node:test"

import {
  getCurrentMembership,
  getCurrentOrganization,
  requireCurrentOrganizationId,
  requireCurrentOrganization,
  requireCurrentTenantWriteAccess,
} from "../../lib/tenant.ts"

test("getCurrentOrganization asegura bootstrap y devuelve la organización activa", async () => {
  const calls = []

  const organization = await getCurrentOrganization({
    getCurrentUser: async () => ({
      id: "user_1",
      defaultOrganizationId: null,
    }),
    ensureOrganizationBootstrapForUser: async (userId) => {
      calls.push(["ensureOrganizationBootstrapForUser", userId])
    },
    getDefaultOrganizationForUser: async (userId) => {
      calls.push(["getDefaultOrganizationForUser", userId])
      return {
        id: "org_1",
        name: "Acme",
      }
    },
    getOrganizationById: async (organizationId) => {
      calls.push(["getOrganizationById", organizationId])
      return {
        id: organizationId,
        name: "Acme",
      }
    },
  })

  assert.deepEqual(organization, {
    id: "org_1",
    name: "Acme",
  })
  assert.deepEqual(calls, [
    ["ensureOrganizationBootstrapForUser", "user_1"],
    ["getDefaultOrganizationForUser", "user_1"],
  ])
})

test("getCurrentMembership resuelve la membership de la organización activa", async () => {
  const calls = []

  const membership = await getCurrentMembership({
    getCurrentUser: async () => ({
      id: "user_1",
      defaultOrganizationId: "org_1",
    }),
    ensureOrganizationBootstrapForUser: async (userId) => {
      calls.push(["ensureOrganizationBootstrapForUser", userId])
    },
    getDefaultOrganizationForUser: async (userId) => {
      calls.push(["getDefaultOrganizationForUser", userId])
      return {
        id: "org_1",
        name: "Acme",
      }
    },
    getOrganizationById: async (organizationId) => {
      calls.push(["getOrganizationById", organizationId])
      return {
        id: organizationId,
        name: "Acme",
      }
    },
    getMembershipByUserAndOrganization: async (userId, organizationId) => {
      calls.push(["getMembershipByUserAndOrganization", userId, organizationId])
      return {
        id: "membership_1",
        userId,
        organizationId,
        role: "owner",
      }
    },
  })

  assert.deepEqual(membership, {
    id: "membership_1",
    userId: "user_1",
    organizationId: "org_1",
    role: "owner",
    accessSource: "membership",
    supportAccessMode: null,
  })
  assert.deepEqual(calls, [
    ["ensureOrganizationBootstrapForUser", "user_1"],
    ["getOrganizationById", "org_1"],
    ["getMembershipByUserAndOrganization", "user_1", "org_1"],
  ])
})

test("requireCurrentOrganization falla si no existe organización activa", async () => {
  await assert.rejects(
    () =>
      requireCurrentOrganization({
        getCurrentUser: async () => ({
          id: "user_1",
          defaultOrganizationId: null,
        }),
        ensureOrganizationBootstrapForUser: async () => {},
        getDefaultOrganizationForUser: async () => null,
      }),
    /No se pudo resolver la organización activa/
  )
})

test("requireCurrentOrganizationId devuelve solo el id del tenant activo", async () => {
  const organizationId = await requireCurrentOrganizationId({
    getCurrentUser: async () => ({
      id: "user_1",
      defaultOrganizationId: "org_1",
    }),
    ensureOrganizationBootstrapForUser: async () => {},
    getOrganizationById: async () => ({
      id: "org_1",
      name: "Acme",
    }),
    getDefaultOrganizationForUser: async () => ({
      id: "org_1",
      name: "Acme",
    }),
  })

  assert.equal(organizationId, "org_1")
})

test("getCurrentMembership devuelve un acceso virtual de soporte cuando no existe membership", async () => {
  const membership = await getCurrentMembership({
    getCurrentUser: async () => ({
      id: "support_1",
      defaultOrganizationId: "org_support",
    }),
    ensureOrganizationBootstrapForUser: async () => {},
    getOrganizationById: async () => ({
      id: "org_support",
      name: "Cliente auditado",
    }),
    getDefaultOrganizationForUser: async () => ({
      id: "org_support",
      name: "Cliente auditado",
    }),
    getMembershipByUserAndOrganization: async () => null,
    getActiveSupportAccessSession: async ({ userId, organizationId }) => ({
      id: "support-session-1",
      userId,
      organizationId,
      mode: "read_only",
    }),
  })

  assert.deepEqual(membership, {
    id: "support-session-1",
    userId: "support_1",
    organizationId: "org_support",
    role: "support",
    accessSource: "support",
    supportAccessMode: "read_only",
  })
})

test("requireCurrentTenantWriteAccess bloquea sesiones de soporte en modo solo lectura", async () => {
  await assert.rejects(
    () =>
      requireCurrentTenantWriteAccess({
        getCurrentUser: async () => ({
          id: "support_1",
          defaultOrganizationId: "org_support",
        }),
        ensureOrganizationBootstrapForUser: async () => {},
        getOrganizationById: async () => ({
          id: "org_support",
          name: "Cliente auditado",
        }),
        getDefaultOrganizationForUser: async () => ({
          id: "org_support",
          name: "Cliente auditado",
        }),
        getMembershipByUserAndOrganization: async () => null,
        getActiveSupportAccessSession: async ({ userId, organizationId }) => ({
          id: "support-session-1",
          userId,
          organizationId,
          mode: "read_only",
        }),
      }),
    /solo lectura/
  )
})

test("requireCurrentTenantWriteAccess permite sesiones de soporte con escritura", async () => {
  const membership = await requireCurrentTenantWriteAccess({
    getCurrentUser: async () => ({
      id: "support_1",
      defaultOrganizationId: "org_support",
    }),
    ensureOrganizationBootstrapForUser: async () => {},
    getOrganizationById: async () => ({
      id: "org_support",
      name: "Cliente auditado",
    }),
    getDefaultOrganizationForUser: async () => ({
      id: "org_support",
      name: "Cliente auditado",
    }),
    getMembershipByUserAndOrganization: async () => null,
    getActiveSupportAccessSession: async ({ userId, organizationId }) => ({
      id: "support-session-2",
      userId,
      organizationId,
      mode: "read_write",
    }),
  })

  assert.equal(membership.supportAccessMode, "read_write")
  assert.equal(membership.accessSource, "support")
})

test("getCurrentOrganization respeta el defaultOrganizationId inyectado por runtime aunque difiera del usuario persistido", async () => {
  const calls = []

  const organization = await getCurrentOrganization({
    getCurrentUser: async () => ({
      id: "target-user",
      defaultOrganizationId: "org_impersonated",
    }),
    ensureOrganizationBootstrapForUser: async (userId) => {
      calls.push(["ensureOrganizationBootstrapForUser", userId])
    },
    getOrganizationById: async (organizationId) => {
      calls.push(["getOrganizationById", organizationId])
      return {
        id: organizationId,
        name: "Cliente asumido",
      }
    },
    getDefaultOrganizationForUser: async (userId) => {
      calls.push(["getDefaultOrganizationForUser", userId])
      return {
        id: "org_persisted",
        name: "Org persistida",
      }
    },
  })

  assert.deepEqual(organization, {
    id: "org_impersonated",
    name: "Cliente asumido",
  })
  assert.deepEqual(calls, [
    ["ensureOrganizationBootstrapForUser", "target-user"],
    ["getOrganizationById", "org_impersonated"],
  ])
})
