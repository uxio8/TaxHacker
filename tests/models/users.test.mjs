import assert from "node:assert/strict"
import test from "node:test"

import { getOrCreateCloudUser, getOrCreateSelfHostedUser, getUserById } from "../../models/users.ts"

test("getOrCreateCloudUser devuelve el usuario refrescado tras bootstrap de organización", async () => {
  const calls = []

  const user = await getOrCreateCloudUser(
    "owner@example.com",
    {
      email: "owner@example.com",
      name: "Owner Demo",
    },
    {
      prisma: {
        user: {
          upsert: async (args) => {
            calls.push(["user.upsert", args])
            return {
              id: "user_1",
              email: "owner@example.com",
              name: "Owner Demo",
              defaultOrganizationId: null,
            }
          },
          findUnique: async (args) => {
            calls.push(["user.findUnique", args])
            return {
              id: "user_1",
              email: "owner@example.com",
              name: "Owner Demo",
              defaultOrganizationId: "user_1",
            }
          },
        },
      },
    ensureOrganizationBootstrapForUser: async (userId) => {
      calls.push(["ensureOrganizationBootstrapForUser", userId])
    },
    ensureOrganizationBillingBootstrapForUser: async (user, organizationId) => {
      calls.push([
        "ensureOrganizationBillingBootstrapForUser",
        {
          userId: user.id,
          organizationId,
        },
      ])
    },
    isDatabaseEmpty: async (userId) => {
      calls.push(["isDatabaseEmpty", userId])
      return true
      },
      createUserDefaults: async (userId) => {
        calls.push(["createUserDefaults", userId])
      },
    }
  )

  assert.equal(user.defaultOrganizationId, "user_1")
  assert.deepEqual(calls, [
    [
      "user.upsert",
      {
        where: { email: "owner@example.com" },
        update: {
          email: "owner@example.com",
          name: "Owner Demo",
        },
        create: {
          email: "owner@example.com",
          name: "Owner Demo",
        },
      },
    ],
    ["ensureOrganizationBootstrapForUser", "user_1"],
    [
      "user.findUnique",
      {
        where: { id: "user_1" },
      },
    ],
    [
      "ensureOrganizationBillingBootstrapForUser",
      {
        userId: "user_1",
        organizationId: "user_1",
      },
    ],
    ["isDatabaseEmpty", "user_1"],
    ["createUserDefaults", "user_1"],
  ])
})

test("getUserById asegura el bootstrap de organización antes de devolver el usuario", async () => {
  const calls = []
  let reads = 0

  const user = await getUserById("user_1", {
    prisma: {
      user: {
        findFirst: async () => null,
        upsert: async () => {
          throw new Error("no debe llamar a upsert")
        },
        update: async () => {
          throw new Error("no debe llamar a update")
        },
        findUnique: async (args) => {
          calls.push(["user.findUnique", args])
          reads += 1

          if (reads === 1) {
            return {
              id: "user_1",
              email: "owner@example.com",
              name: "Owner Demo",
              defaultOrganizationId: null,
            }
          }

          return {
            id: "user_1",
            email: "owner@example.com",
            name: "Owner Demo",
            defaultOrganizationId: "org_1",
          }
        },
      },
    },
    ensureOrganizationBootstrapForUser: async (userId) => {
      calls.push(["ensureOrganizationBootstrapForUser", userId])
    },
    ensureOrganizationBillingBootstrapForUser: async (user, organizationId) => {
      calls.push([
        "ensureOrganizationBillingBootstrapForUser",
        {
          userId: user.id,
          organizationId,
        },
      ])
    },
    isDatabaseEmpty: async () => false,
    createUserDefaults: async () => {},
  })

  assert.equal(user?.defaultOrganizationId, "org_1")
  assert.deepEqual(calls, [
    [
      "user.findUnique",
      {
        where: { id: "user_1" },
      },
    ],
    ["ensureOrganizationBootstrapForUser", "user_1"],
    [
      "user.findUnique",
      {
        where: { id: "user_1" },
      },
    ],
    [
      "ensureOrganizationBillingBootstrapForUser",
      {
        userId: "user_1",
        organizationId: "org_1",
      },
    ],
  ])
})

test("getOrCreateSelfHostedUser asegura bootstrap de organización y platform owner", async () => {
  const calls = []

  const user = await getOrCreateSelfHostedUser({
    prisma: {
      user: {
        findFirst: async () => null,
        upsert: async (args) => {
          calls.push(["user.upsert", args])
          return {
            id: "self_hosted",
            email: "taxhacker@localhost",
            name: "Self-Hosted Mode",
            defaultOrganizationId: null,
          }
        },
        findUnique: async (args) => {
          calls.push(["user.findUnique", args])
          return {
            id: "self_hosted",
            email: "taxhacker@localhost",
            name: "Self-Hosted Mode",
            defaultOrganizationId: "self_hosted",
          }
        },
        update: async () => {
          throw new Error("no debe llamar a update")
        },
      },
    },
    ensureOrganizationBootstrapForUser: async (userId) => {
      calls.push(["ensureOrganizationBootstrapForUser", userId])
    },
    ensureOrganizationBillingBootstrapForUser: async (user, organizationId) => {
      calls.push([
        "ensureOrganizationBillingBootstrapForUser",
        {
          userId: user.id,
          organizationId,
        },
      ])
    },
    ensureSelfHostedPlatformOwner: async (userId) => {
      calls.push(["ensureSelfHostedPlatformOwner", userId])
    },
    isDatabaseEmpty: async () => false,
    createUserDefaults: async () => {},
  })

  assert.equal(user.defaultOrganizationId, "self_hosted")
  assert.deepEqual(calls, [
    [
      "user.upsert",
      {
        where: { email: "taxhacker@localhost" },
        update: {
          email: "taxhacker@localhost",
          name: "Self-Hosted Mode",
          membershipPlan: "unlimited",
        },
        create: {
          email: "taxhacker@localhost",
          name: "Self-Hosted Mode",
          membershipPlan: "unlimited",
        },
      },
    ],
    ["ensureOrganizationBootstrapForUser", "self_hosted"],
    ["ensureSelfHostedPlatformOwner", "self_hosted"],
    [
      "user.findUnique",
      {
        where: { id: "self_hosted" },
      },
    ],
    [
      "ensureOrganizationBillingBootstrapForUser",
      {
        userId: "self_hosted",
        organizationId: "self_hosted",
      },
    ],
  ])
})
