import assert from "node:assert/strict"
import test from "node:test"

import {
  deleteMembership,
  getMembershipByUserAndOrganization,
  listMembersByOrganizationId,
  listMembershipUserNamespacesByOrganizationId,
  listMembershipsByUserId,
  setMembershipRole,
  transferOrganizationOwnership,
  upsertMembership,
} from "../../models/memberships.ts"

function createStore(overrides = {}) {
  return {
    membership: {
      findUnique: async () => null,
      findMany: async () => [],
      upsert: async () => null,
      update: async () => null,
      deleteMany: async () => ({ count: 0 }),
    },
    ...overrides,
  }
}

test("upsertMembership persiste role con clave compuesta userId+organizationId", async () => {
  const calls = []
  const membership = await upsertMembership("user_1", "org_1", "owner", createStore({
    membership: {
      findUnique: async () => null,
      findMany: async () => [],
      upsert: async (args) => {
        calls.push(args)
        return {
          id: "membership_1",
          userId: "user_1",
          organizationId: "org_1",
          role: "owner",
        }
      },
    },
  }))

  assert.deepEqual(membership, {
    id: "membership_1",
    userId: "user_1",
    organizationId: "org_1",
    role: "owner",
  })
  assert.deepEqual(calls, [
    {
      where: {
        userId_organizationId: {
          userId: "user_1",
          organizationId: "org_1",
        },
      },
      update: {
        role: "owner",
      },
      create: {
        userId: "user_1",
        organizationId: "org_1",
        role: "owner",
      },
    },
  ])
})

test("listMembersByOrganizationId devuelve miembros con identidad y rol", async () => {
  const members = await listMembersByOrganizationId("org_1", createStore({
    membership: {
      findUnique: async () => null,
      upsert: async () => null,
      deleteMany: async () => ({ count: 0 }),
      findMany: async (args) => {
        assert.deepEqual(args, {
          where: { organizationId: "org_1" },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            userId: true,
            organizationId: true,
            role: true,
            user: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        })

        return [
          {
            id: "membership_1",
            userId: "user_1",
            organizationId: "org_1",
            role: "owner",
            user: {
              email: "owner@example.com",
              name: "Owner",
            },
          },
        ]
      },
    },
  }))

  assert.deepEqual(members, [
    {
      id: "membership_1",
      userId: "user_1",
      organizationId: "org_1",
      role: "owner",
      user: {
        email: "owner@example.com",
        name: "Owner",
      },
    },
  ])
})

test("deleteMembership borra por clave compuesta", async () => {
  const calls = []
  const count = await deleteMembership("user_2", "org_1", createStore({
    membership: {
      findUnique: async () => null,
      upsert: async () => null,
      findMany: async () => [],
      deleteMany: async (args) => {
        calls.push(args)
        return { count: 1 }
      },
    },
  }))

  assert.equal(count, 1)
  assert.deepEqual(calls, [
    {
      where: {
        userId: "user_2",
        organizationId: "org_1",
      },
    },
  ])
})

test("listMembershipsByUserId ordena por createdAt descendente", async () => {
  const memberships = await listMembershipsByUserId("user_1", createStore({
    membership: {
      findUnique: async () => null,
      upsert: async () => null,
      findMany: async (args) => {
        assert.deepEqual(args, {
          where: { userId: "user_1" },
          orderBy: { createdAt: "desc" },
        })

        return [
          {
            id: "membership_2",
            userId: "user_1",
            organizationId: "org_2",
            role: "member",
          },
        ]
      },
    },
  }))

  assert.deepEqual(memberships, [
    {
      id: "membership_2",
      userId: "user_1",
      organizationId: "org_2",
      role: "member",
    },
  ])
})

test("setMembershipRole actualiza el role de una membership existente", async () => {
  const calls = []
  const membership = await setMembershipRole("user_1", "org_1", "admin", createStore({
    membership: {
      findUnique: async () => null,
      findMany: async () => [],
      upsert: async () => null,
      deleteMany: async () => ({ count: 0 }),
      update: async (args) => {
        calls.push(args)
        return {
          id: "membership_1",
          userId: "user_1",
          organizationId: "org_1",
          role: "admin",
        }
      },
    },
  }))

  assert.equal(membership.role, "admin")
  assert.deepEqual(calls, [
    {
      where: {
        userId_organizationId: {
          userId: "user_1",
          organizationId: "org_1",
        },
      },
      data: {
        role: "admin",
      },
    },
  ])
})

test("transferOrganizationOwnership degrada al owner actual y promociona al nuevo", async () => {
  const calls = []

  const updatedMembership = await transferOrganizationOwnership(
    {
      organizationId: "org_1",
      currentOwnerUserId: "owner_1",
      nextOwnerUserId: "admin_1",
    },
    createStore({
      membership: {
        findMany: async () => [],
        upsert: async () => null,
        deleteMany: async () => ({ count: 0 }),
        findUnique: async ({ where }) => {
          if (where.userId_organizationId.userId === "admin_1") {
            return {
              id: "membership_2",
              userId: "admin_1",
              organizationId: "org_1",
              role: "admin",
            }
          }

          return {
            id: "membership_1",
            userId: "owner_1",
            organizationId: "org_1",
            role: "owner",
          }
        },
        update: async (args) => {
          calls.push(args)
          return {
            id: args.where.userId_organizationId.userId === "admin_1" ? "membership_2" : "membership_1",
            userId: args.where.userId_organizationId.userId,
            organizationId: "org_1",
            role: args.data.role,
          }
        },
      },
    })
  )

  assert.deepEqual(calls, [
    {
      where: {
        userId_organizationId: {
          userId: "owner_1",
          organizationId: "org_1",
        },
      },
      data: {
        role: "admin",
      },
    },
    {
      where: {
        userId_organizationId: {
          userId: "admin_1",
          organizationId: "org_1",
        },
      },
      data: {
        role: "owner",
      },
    },
  ])
  assert.deepEqual(updatedMembership, {
    id: "membership_2",
    userId: "admin_1",
    organizationId: "org_1",
    role: "owner",
  })
})

test("getMembershipByUserAndOrganization consulta por la clave compuesta", async () => {
  const membership = await getMembershipByUserAndOrganization("user_1", "org_1", createStore({
    membership: {
      findMany: async () => [],
      upsert: async () => null,
      findUnique: async (args) => {
        assert.deepEqual(args, {
          where: {
            userId_organizationId: {
              userId: "user_1",
              organizationId: "org_1",
            },
          },
        })

        return {
          id: "membership_1",
          userId: "user_1",
          organizationId: "org_1",
          role: "admin",
        }
      },
    },
  }))

  assert.deepEqual(membership, {
    id: "membership_1",
    userId: "user_1",
    organizationId: "org_1",
    role: "admin",
  })
})

test("upsertMembership rechaza roles fuera del contrato minimo", async () => {
  await assert.rejects(
    upsertMembership("user_1", "org_1", "superadmin", createStore()),
    /Role invalido/
  )
})

test("upsertMembership impide degradar al último owner de la organización", async () => {
  await assert.rejects(
    upsertMembership(
      "owner_1",
      "org_1",
      "admin",
      createStore({
        membership: {
          findUnique: async () => ({
            id: "membership_1",
            userId: "owner_1",
            organizationId: "org_1",
            role: "owner",
          }),
          findMany: async () => [{ userId: "owner_1" }],
          upsert: async () => null,
          update: async () => null,
          deleteMany: async () => ({ count: 0 }),
        },
      })
    ),
    /debe conservar al menos una persona owner/
  )
})

test("deleteMembership impide borrar al último owner de la organización", async () => {
  await assert.rejects(
    deleteMembership(
      "owner_1",
      "org_1",
      createStore({
        membership: {
          findUnique: async () => ({
            id: "membership_1",
            userId: "owner_1",
            organizationId: "org_1",
            role: "owner",
          }),
          findMany: async () => [{ userId: "owner_1" }],
          upsert: async () => null,
          update: async () => null,
          deleteMany: async () => ({ count: 0 }),
        },
      })
    ),
    /debe conservar al menos una persona owner/
  )
})

test("listMembershipUserNamespacesByOrganizationId devuelve ids y emails unicos de todos los miembros", async () => {
  const namespaces = await listMembershipUserNamespacesByOrganizationId("org_1", createStore({
    membership: {
      findUnique: async () => null,
      upsert: async () => null,
      findMany: async (args) => {
        assert.deepEqual(args, {
          where: { organizationId: "org_1" },
          select: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        })

        return [
          {
            user: {
              id: "user_1",
              email: "owner@example.com",
            },
          },
          {
            user: {
              id: "user_2",
              email: "member@example.com",
            },
          },
          {
            user: {
              id: "user_1",
              email: "owner@example.com",
            },
          },
        ]
      },
    },
  }))

  assert.deepEqual(namespaces, [
    "user_1",
    "owner@example.com",
    "user_2",
    "member@example.com",
  ])
})
