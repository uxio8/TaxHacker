import assert from "node:assert/strict"
import test from "node:test"

import {
  acceptOrganizationInvitation,
  buildInvitationToken,
  createOrganizationInvitation,
  revokeOrganizationInvitation,
} from "../../models/invitations.ts"

function createStore(overrides = {}) {
  const baseStore = {
    organizationInvitation: {
      create: async () => null,
      findUnique: async () => null,
      update: async () => null,
      findMany: async () => [],
    },
    membership: {
      upsert: async () => null,
    },
    user: {
      update: async () => null,
    },
  }

  return {
    ...baseStore,
    ...overrides,
  }
}

test("buildInvitationToken devuelve un token no vacio", () => {
  assert.equal(typeof buildInvitationToken(), "string")
  assert.ok(buildInvitationToken().length > 10)
})

test("createOrganizationInvitation normaliza email y persiste el token", async () => {
  const calls = []
  const invitation = await createOrganizationInvitation(
    {
      organizationId: "org-1",
      email: " Admin@Example.com ",
      role: "admin",
      invitedByUserId: "user-1",
      expiresAt: new Date("2026-03-30T00:00:00.000Z"),
    },
    {
      store: createStore({
        organizationInvitation: {
          create: async (args) => {
            calls.push(args)
            return {
              id: "invite-1",
              ...args.data,
            }
          },
          findUnique: async () => null,
          update: async () => null,
          findMany: async () => [],
        },
      }),
      tokenFactory: () => "token-123",
    }
  )

  assert.equal(invitation.emailNormalized, "admin@example.com")
  assert.equal(invitation.token, "token-123")
  assert.equal(calls[0].data.email, "Admin@Example.com")
})

test("acceptOrganizationInvitation acepta la invitacion, hace upsert de membership y cambia la org activa", async () => {
  const calls = []
  const result = await acceptOrganizationInvitation(
    {
      token: "token-123",
      userId: "user-2",
      userEmail: "member@example.com",
    },
    {
      store: createStore({
        organizationInvitation: {
          findUnique: async () => ({
            id: "invite-1",
            organizationId: "org-1",
            emailNormalized: "member@example.com",
            role: "member",
            expiresAt: new Date("2026-03-30T00:00:00.000Z"),
            acceptedAt: null,
            revokedAt: null,
          }),
          update: async (args) => {
            calls.push(["invitation.update", args])
            return null
          },
          create: async () => null,
          findMany: async () => [],
        },
        membership: {
          upsert: async (args) => {
            calls.push(["membership.upsert", args])
            return null
          },
        },
        user: {
          update: async (args) => {
            calls.push(["user.update", args])
            return null
          },
        },
      }),
      now: new Date("2026-03-23T00:00:00.000Z"),
    }
  )

  assert.deepEqual(result, {
    accepted: true,
    organizationId: "org-1",
    role: "member",
  })
  assert.deepEqual(calls, [
    [
      "membership.upsert",
      {
        where: {
          userId_organizationId: {
            userId: "user-2",
            organizationId: "org-1",
          },
        },
        update: {
          role: "member",
        },
        create: {
          userId: "user-2",
          organizationId: "org-1",
          role: "member",
        },
      },
    ],
    [
      "user.update",
      {
        where: { id: "user-2" },
        data: {
          defaultOrganizationId: "org-1",
        },
      },
    ],
    [
      "invitation.update",
      {
        where: { token: "token-123" },
        data: {
          acceptedAt: new Date("2026-03-23T00:00:00.000Z"),
          acceptedByUserId: "user-2",
        },
      },
    ],
  ])
})

test("revokeOrganizationInvitation marca revokedAt", async () => {
  const calls = []
  await revokeOrganizationInvitation(
    {
      token: "token-123",
      revokedAt: new Date("2026-03-23T00:00:00.000Z"),
    },
    createStore({
      organizationInvitation: {
        update: async (args) => {
          calls.push(args)
          return null
        },
        create: async () => null,
        findUnique: async () => null,
        findMany: async () => [],
      },
    })
  )

  assert.deepEqual(calls, [
    {
      where: { token: "token-123" },
      data: {
        revokedAt: new Date("2026-03-23T00:00:00.000Z"),
      },
    },
  ])
})
