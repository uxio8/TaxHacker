import assert from "node:assert/strict"
import test from "node:test"

import {
  buildDefaultOrganizationName,
  createOrganizationForOps,
  ensureDefaultOrganizationForUser,
  getDefaultOrganizationForUser,
  listOrganizationsForUser,
  setCurrentOrganizationForUser,
} from "../../models/organizations.ts"

function createStore(overrides = {}) {
  const baseStore = {
    $transaction: async (callback) => callback(baseStore),
    user: {
      findUnique: async () => null,
      update: async () => null,
    },
    organization: {
      findUnique: async () => null,
      create: async () => null,
      upsert: async () => null,
    },
    organizationInvitation: {
      create: async () => null,
    },
    membership: {
      upsert: async () => null,
      findMany: async () => [],
      findUnique: async () => null,
    },
  }

  return {
    ...baseStore,
    ...overrides,
  }
}

test("buildDefaultOrganizationName prioriza businessName y hace fallback a name o email", () => {
  assert.equal(
    buildDefaultOrganizationName({
      name: "Usuario Demo",
      email: "demo@example.com",
      businessName: " LedgerFlow Demo SL ",
    }),
    "LedgerFlow Demo SL"
  )

  assert.equal(
    buildDefaultOrganizationName({
      name: " Usuario Demo ",
      email: "demo@example.com",
      businessName: "   ",
    }),
    "Usuario Demo"
  )

  assert.equal(
    buildDefaultOrganizationName({
      name: "   ",
      email: "owner@example.com",
      businessName: null,
    }),
    "owner"
  )

  assert.equal(
    buildDefaultOrganizationName({
      name: "   ",
      email: "",
      businessName: null,
    }),
    "Organization"
  )
})

test("ensureDefaultOrganizationForUser usa upserts deterministas para evitar duplicados y fija defaultOrganizationId si falta", async () => {
  const calls = []
  const store = createStore({
    user: {
      findUnique: async (args) => {
        calls.push(["user.findUnique", args])

        return {
          id: "user_1",
          email: "owner@example.com",
          name: "Owner Demo",
          businessName: "LedgerFlow Demo SL",
          defaultOrganizationId: null,
        }
      },
      update: async (args) => {
        calls.push(["user.update", args])
        return {
          id: "user_1",
          defaultOrganizationId: "org_1",
        }
      },
    },
    organization: {
      findUnique: async (args) => {
        calls.push(["organization.findUnique", args])
        return null
      },
      upsert: async (args) => {
        calls.push(["organization.upsert", args])
        return {
          id: "user_1",
          name: "LedgerFlow Demo SL",
        }
      },
    },
    membership: {
      upsert: async (args) => {
        calls.push(["membership.upsert", args])
        return {
          id: "membership_1",
          userId: "user_1",
          organizationId: "user_1",
          role: "owner",
        }
      },
    },
  })

  const organization = await ensureDefaultOrganizationForUser("user_1", store)

  assert.deepEqual(organization, {
    id: "user_1",
    name: "LedgerFlow Demo SL",
  })
  assert.deepEqual(calls, [
    [
      "user.findUnique",
      {
        where: { id: "user_1" },
        select: {
          id: true,
          email: true,
          name: true,
          businessName: true,
          defaultOrganizationId: true,
        },
      },
    ],
    [
      "user.findUnique",
      {
        where: { id: "user_1" },
        select: {
          id: true,
          email: true,
          name: true,
          businessName: true,
          defaultOrganizationId: true,
        },
      },
    ],
    [
      "organization.upsert",
      {
        where: { id: "user_1" },
        update: {
          name: "LedgerFlow Demo SL",
        },
        create: {
          id: "user_1",
          name: "LedgerFlow Demo SL",
        },
      },
    ],
    [
      "membership.upsert",
      {
        where: {
          userId_organizationId: {
            userId: "user_1",
            organizationId: "user_1",
          },
        },
        update: {
          role: "owner",
        },
        create: {
          userId: "user_1",
          organizationId: "user_1",
          role: "owner",
        },
      },
    ],
    [
      "user.update",
      {
        where: { id: "user_1" },
        data: {
          defaultOrganizationId: "user_1",
        },
      },
    ],
  ])
})

test("createOrganizationForOps crea la empresa y asigna owner si el usuario ya existe", async () => {
  const calls = []
  const store = createStore({
    user: {
      findUnique: async (args) => {
        calls.push(["user.findUnique", args])

        return {
          id: "user_owner",
          email: "owner@example.com",
        }
      },
      update: async () => {
        throw new Error("no deberia tocar user.update")
      },
    },
    organization: {
      findUnique: async () => null,
      upsert: async () => null,
      create: async (args) => {
        calls.push(["organization.create", args])

        return {
          id: "org_new",
          name: args.data.name,
        }
      },
    },
    membership: {
      upsert: async (args) => {
        calls.push(["membership.upsert", args])
        return null
      },
      findMany: async () => [],
      findUnique: async () => null,
    },
    organizationInvitation: {
      create: async () => {
        throw new Error("no deberia crear invitacion")
      },
    },
  })

  const result = await createOrganizationForOps(
    {
      name: "  Acme Labs SL  ",
      ownerEmail: " OWNER@EXAMPLE.COM ",
      actorUserId: "admin_1",
    },
    store,
    {
      idFactory: () => "org_new",
      now: new Date("2026-03-23T00:00:00.000Z"),
    }
  )

  assert.deepEqual(result, {
    organization: {
      id: "org_new",
      name: "Acme Labs SL",
    },
    owner: {
      type: "existing_user",
      userId: "user_owner",
      email: "owner@example.com",
    },
    initialUsers: [],
  })

  assert.deepEqual(calls, [
    [
      "organization.create",
      {
        data: {
          id: "org_new",
          name: "Acme Labs SL",
        },
      },
    ],
    [
      "user.findUnique",
      {
        where: {
          email: "owner@example.com",
        },
        select: {
          id: true,
          email: true,
        },
      },
    ],
    [
      "membership.upsert",
      {
        where: {
          userId_organizationId: {
            userId: "user_owner",
            organizationId: "org_new",
          },
        },
        update: {
          role: "owner",
        },
        create: {
          userId: "user_owner",
          organizationId: "org_new",
          role: "owner",
        },
      },
    ],
  ])
})

test("createOrganizationForOps crea invitacion owner si el email no existe", async () => {
  const calls = []
  const store = createStore({
    user: {
      findUnique: async (args) => {
        calls.push(["user.findUnique", args])
        return null
      },
      update: async () => {
        throw new Error("no deberia tocar user.update")
      },
    },
    organization: {
      findUnique: async () => null,
      upsert: async () => null,
      create: async (args) => {
        calls.push(["organization.create", args])

        return {
          id: "org_new",
          name: args.data.name,
        }
      },
    },
    membership: {
      upsert: async () => {
        throw new Error("no deberia asignar membership")
      },
      findMany: async () => [],
      findUnique: async () => null,
    },
    organizationInvitation: {
      create: async (args) => {
        calls.push(["organizationInvitation.create", args])
        return {
          id: "invite_1",
          ...args.data,
        }
      },
    },
  })

  const result = await createOrganizationForOps(
    {
      name: "Tax Hacker Client",
      ownerEmail: "new-owner@example.com",
      actorUserId: "admin_1",
    },
    store,
    {
      idFactory: () => "org_new",
      tokenFactory: () => "invite-token-1",
      now: new Date("2026-03-23T00:00:00.000Z"),
    }
  )

  assert.deepEqual(result, {
    organization: {
      id: "org_new",
      name: "Tax Hacker Client",
    },
    owner: {
      type: "invited_email",
      email: "new-owner@example.com",
      invitationToken: "invite-token-1",
    },
    initialUsers: [],
  })

  assert.deepEqual(calls, [
    [
      "organization.create",
      {
        data: {
          id: "org_new",
          name: "Tax Hacker Client",
        },
      },
    ],
    [
      "user.findUnique",
      {
        where: {
          email: "new-owner@example.com",
        },
        select: {
          id: true,
          email: true,
        },
      },
    ],
    [
      "organizationInvitation.create",
      {
        data: {
          organizationId: "org_new",
          email: "new-owner@example.com",
          emailNormalized: "new-owner@example.com",
          role: "owner",
          token: "invite-token-1",
          invitedByUserId: "admin_1",
          expiresAt: new Date("2026-04-06T00:00:00.000Z"),
        },
      },
    ],
  ])
})

test("createOrganizationForOps registra usuarios iniciales como memberships o invitaciones segun exista el email", async () => {
  const calls = []
  const usersByEmail = new Map([
    ["owner@example.com", { id: "user_owner", email: "owner@example.com" }],
    ["admin@example.com", { id: "user_admin", email: "admin@example.com" }],
  ])

  const store = createStore({
    user: {
      findUnique: async (args) => {
        calls.push(["user.findUnique", args])
        return usersByEmail.get(args.where.email) ?? null
      },
      update: async () => {
        throw new Error("no deberia tocar user.update")
      },
    },
    organization: {
      findUnique: async () => null,
      upsert: async () => null,
      create: async (args) => {
        calls.push(["organization.create", args])

        return {
          id: "org_new",
          name: args.data.name,
        }
      },
    },
    membership: {
      upsert: async (args) => {
        calls.push(["membership.upsert", args])
        return null
      },
      findMany: async () => [],
      findUnique: async () => null,
    },
    organizationInvitation: {
      create: async (args) => {
        calls.push(["organizationInvitation.create", args])
        return {
          id: `invite_${calls.filter(([event]) => event === "organizationInvitation.create").length}`,
          ...args.data,
        }
      },
    },
  })

  const result = await createOrganizationForOps(
    {
      name: "Cliente con equipo",
      ownerEmail: "owner@example.com",
      actorUserId: "admin_1",
      initialUsers: [
        { email: "admin@example.com", role: "admin" },
        { email: "pending.member@example.com", role: "member" },
        { email: " owner@example.com ", role: "member" },
        { email: "ADMIN@example.com", role: "member" },
        { email: "   ", role: "member" },
      ],
    },
    store,
    {
      idFactory: () => "org_new",
      tokenFactory: (() => {
        let index = 0
        return () => `invite-token-${++index}`
      })(),
      now: new Date("2026-03-23T00:00:00.000Z"),
    }
  )

  assert.deepEqual(result, {
    organization: {
      id: "org_new",
      name: "Cliente con equipo",
    },
    owner: {
      type: "existing_user",
      userId: "user_owner",
      email: "owner@example.com",
    },
    initialUsers: [
      {
        type: "existing_user",
        userId: "user_admin",
        email: "admin@example.com",
        role: "admin",
      },
      {
        type: "invited_email",
        email: "pending.member@example.com",
        invitationToken: "invite-token-1",
        role: "member",
      },
    ],
  })

  assert.deepEqual(calls, [
    [
      "organization.create",
      {
        data: {
          id: "org_new",
          name: "Cliente con equipo",
        },
      },
    ],
    [
      "user.findUnique",
      {
        where: {
          email: "owner@example.com",
        },
        select: {
          id: true,
          email: true,
        },
      },
    ],
    [
      "membership.upsert",
      {
        where: {
          userId_organizationId: {
            userId: "user_owner",
            organizationId: "org_new",
          },
        },
        update: {
          role: "owner",
        },
        create: {
          userId: "user_owner",
          organizationId: "org_new",
          role: "owner",
        },
      },
    ],
    [
      "user.findUnique",
      {
        where: {
          email: "admin@example.com",
        },
        select: {
          id: true,
          email: true,
        },
      },
    ],
    [
      "membership.upsert",
      {
        where: {
          userId_organizationId: {
            userId: "user_admin",
            organizationId: "org_new",
          },
        },
        update: {
          role: "admin",
        },
        create: {
          userId: "user_admin",
          organizationId: "org_new",
          role: "admin",
        },
      },
    ],
    [
      "user.findUnique",
      {
        where: {
          email: "pending.member@example.com",
        },
        select: {
          id: true,
          email: true,
        },
      },
    ],
    [
      "organizationInvitation.create",
      {
        data: {
          organizationId: "org_new",
          email: "pending.member@example.com",
          emailNormalized: "pending.member@example.com",
          role: "member",
          token: "invite-token-1",
          invitedByUserId: "admin_1",
          expiresAt: new Date("2026-04-06T00:00:00.000Z"),
        },
      },
    ],
  ])
})

test("ensureDefaultOrganizationForUser reutiliza la organization por defecto y repara la membership owner si ya existe", async () => {
  const calls = []
  const store = createStore({
    user: {
      findUnique: async (args) => {
        calls.push(["user.findUnique", args])

        return {
          id: "user_1",
          email: "owner@example.com",
          name: "Owner Demo",
          businessName: null,
          defaultOrganizationId: "org_existing",
        }
      },
      update: async () => {
        throw new Error("no deberia tocar user.update")
      },
    },
    organization: {
      findUnique: async (args) => {
        calls.push(["organization.findUnique", args])
        return {
          id: "org_existing",
          name: "Workspace existente",
        }
      },
      upsert: async () => {
        throw new Error("no deberia crear organization")
      },
    },
    membership: {
      upsert: async (args) => {
        calls.push(["membership.upsert", args])
        return {
          id: "membership_1",
          userId: "user_1",
          organizationId: "org_existing",
          role: "owner",
        }
      },
    },
  })

  const organization = await ensureDefaultOrganizationForUser("user_1", store)

  assert.deepEqual(organization, {
    id: "org_existing",
    name: "Workspace existente",
  })
  assert.deepEqual(calls, [
    [
      "user.findUnique",
      {
        where: { id: "user_1" },
        select: {
          id: true,
          email: true,
          name: true,
          businessName: true,
          defaultOrganizationId: true,
        },
      },
    ],
    [
      "organization.findUnique",
      {
        where: { id: "org_existing" },
      },
    ],
    [
      "membership.upsert",
      {
        where: {
          userId_organizationId: {
            userId: "user_1",
            organizationId: "org_existing",
          },
        },
        update: {
          role: "owner",
        },
        create: {
          userId: "user_1",
          organizationId: "org_existing",
          role: "owner",
        },
      },
    ],
  ])
})

test("listOrganizationsForUser añade accesos de soporte activos sin duplicar organizaciones con membership", async () => {
  const store = createStore({
    membership: {
      upsert: async () => null,
      findUnique: async () => null,
      findMany: async () => [
        {
          role: "owner",
          organization: {
            id: "org-member",
            name: "Empresa propia",
          },
        },
      ],
    },
  })

  const organizations = await listOrganizationsForUser("user_1", store, {
    listActiveSupportOrganizationsForUser: async () => [
      {
        id: "org-support-read",
        name: "Cliente soporte lectura",
        mode: "read_only",
      },
      {
        id: "org-member",
        name: "Empresa propia",
        mode: "read_write",
      },
    ],
  })

  assert.deepEqual(organizations, [
    {
      id: "org-member",
      name: "Empresa propia",
      role: "owner",
    },
    {
      id: "org-support-read",
      name: "Cliente soporte lectura",
      role: "support_read_only",
    },
  ])
})

test("setCurrentOrganizationForUser permite cambiar a una organización con sesión de soporte activa", async () => {
  const calls = []
  const store = createStore({
    user: {
      findUnique: async () => null,
      update: async (args) => {
        calls.push(["user.update", args])
        return null
      },
    },
    membership: {
      upsert: async () => null,
      findMany: async () => [],
      findUnique: async (args) => {
        calls.push(["membership.findUnique", args])
        return null
      },
    },
  })

  const result = await setCurrentOrganizationForUser("user_1", "org_support", store, {
    hasActiveSupportAccess: async (input) => {
      calls.push(["hasActiveSupportAccess", input])
      return true
    },
  })

  assert.equal(result, true)
  assert.deepEqual(calls, [
    [
      "membership.findUnique",
      {
        where: {
          userId_organizationId: {
            userId: "user_1",
            organizationId: "org_support",
          },
        },
      },
    ],
    [
      "hasActiveSupportAccess",
      {
        userId: "user_1",
        organizationId: "org_support",
      },
    ],
    [
      "user.update",
      {
        where: { id: "user_1" },
        data: {
          defaultOrganizationId: "org_support",
        },
      },
    ],
  ])
})

test("getDefaultOrganizationForUser devuelve null si el usuario no tiene organization por defecto", async () => {
  const store = createStore({
    user: {
      findUnique: async () => ({
        id: "user_1",
        defaultOrganizationId: null,
      }),
      update: async () => null,
    },
  })

  const organization = await getDefaultOrganizationForUser("user_1", store)

  assert.equal(organization, null)
})

test("listOrganizationsForUser devuelve las organizaciones accesibles con su rol", async () => {
  const organizations = await listOrganizationsForUser("user_1", createStore({
    membership: {
      upsert: async () => null,
      findUnique: async () => null,
      findMany: async () => [
        {
          role: "owner",
          organization: {
            id: "org_1",
            name: "Alpha SL",
          },
        },
        {
          role: "member",
          organization: {
            id: "org_2",
            name: "Beta Studio",
          },
        },
      ],
    },
  }))

  assert.deepEqual(organizations, [
    {
      id: "org_1",
      name: "Alpha SL",
      role: "owner",
    },
    {
      id: "org_2",
      name: "Beta Studio",
      role: "member",
    },
  ])
})

test("setCurrentOrganizationForUser solo cambia la organization activa si la membership existe", async () => {
  const calls = []
  const store = createStore({
    membership: {
      upsert: async () => null,
      findMany: async () => [],
      findUnique: async (args) => {
        calls.push(["membership.findUnique", args])

        return {
          id: "membership_1",
          userId: "user_1",
          organizationId: "org_2",
          role: "admin",
        }
      },
    },
    user: {
      findUnique: async () => ({
        id: "user_1",
        email: "owner@example.com",
        name: "Owner Demo",
        businessName: null,
        defaultOrganizationId: "org_1",
      }),
      update: async (args) => {
        calls.push(["user.update", args])
        return null
      },
    },
  })

  const updated = await setCurrentOrganizationForUser("user_1", "org_2", store)

  assert.equal(updated, true)
  assert.deepEqual(calls, [
    [
      "membership.findUnique",
      {
        where: {
          userId_organizationId: {
            userId: "user_1",
            organizationId: "org_2",
          },
        },
      },
    ],
    [
      "user.update",
      {
        where: { id: "user_1" },
        data: {
          defaultOrganizationId: "org_2",
        },
      },
    ],
  ])
})
