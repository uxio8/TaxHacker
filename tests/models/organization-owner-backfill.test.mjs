import assert from "node:assert/strict"
import test from "node:test"

import {
  buildDefaultUserNameFromEmail,
  runOrganizationOwnerBackfill,
} from "../../models/organization-owner-backfill.ts"

function createStore(overrides = {}) {
  const baseStore = {
    organization: {
      findMany: async () => [],
    },
    user: {
      findUnique: async () => null,
      create: async () => null,
      update: async () => null,
    },
    membership: {
      findFirst: async () => null,
      upsert: async () => null,
    },
    organizationInvitation: {
      findMany: async () => [],
      update: async () => null,
    },
  }

  return {
    ...baseStore,
    ...overrides,
  }
}

test("buildDefaultUserNameFromEmail usa el local-part con fallback legible", () => {
  assert.equal(buildDefaultUserNameFromEmail(" Owner.Demo@example.com "), "owner.demo")
  assert.equal(buildDefaultUserNameFromEmail(""), "Owner")
})

test("runOrganizationOwnerBackfill en dry-run solo cuenta organizaciones elegibles", async () => {
  const store = createStore({
    organization: {
      findMany: async (args) => {
        const requestedNames = new Set(
          args.where.OR.map((entry) => entry.name.equals.toLowerCase())
        )

        return [
          { id: "org_1", name: "Quadrivo" },
          { id: "org_2", name: "Otro cliente" },
        ].filter((organization) => requestedNames.has(organization.name.toLowerCase()))
      },
    },
    membership: {
      findFirst: async ({ where }) => (where.organizationId === "org_2" ? { id: "membership_1" } : null),
      upsert: async () => {
        throw new Error("no deberia hacer upsert en dry-run")
      },
    },
    organizationInvitation: {
      findMany: async ({ where }) => {
        if (where.organizationId !== "org_1") {
          return []
        }

        return [
          {
            id: "invite_1",
            email: "owner@quadrivo.com",
            emailNormalized: "owner@quadrivo.com",
            role: "owner",
            revokedAt: null,
            acceptedAt: null,
            expiresAt: new Date("2099-01-01T00:00:00.000Z"),
            createdAt: new Date("2026-03-24T09:00:00.000Z"),
          },
        ]
      },
      update: async () => {
        throw new Error("no deberia tocar invitaciones en dry-run")
      },
    },
    user: {
      findUnique: async () => null,
      create: async () => {
        throw new Error("no deberia crear usuarios en dry-run")
      },
      update: async () => {
        throw new Error("no deberia actualizar usuarios en dry-run")
      },
    },
  })

  const report = await runOrganizationOwnerBackfill(
    {
      organizationNames: ["Quadrivo", "CUADRIVO2"],
      dryRun: true,
      now: new Date("2026-03-24T10:00:00.000Z"),
    },
    store
  )

  assert.deepEqual(report, {
    scanned: 1,
    eligible: 1,
    backfilled: 0,
    skipped: 0,
    missingOrganizations: ["CUADRIVO2"],
    results: [
      {
        organizationId: "org_1",
        organizationName: "Quadrivo",
        status: "eligible_dry_run",
        email: "owner@quadrivo.com",
      },
    ],
  })
})

test("runOrganizationOwnerBackfill crea owner minimo, hace membership y revoca invitaciones pendientes", async () => {
  const calls = []

  const store = createStore({
    organization: {
      findMany: async () => [{ id: "org_1", name: "Quadrivo" }],
    },
    membership: {
      findFirst: async () => null,
      upsert: async (args) => {
        calls.push(["membership.upsert", args])
        return null
      },
    },
    organizationInvitation: {
      findMany: async () => [
        {
          id: "invite_2",
          email: "owner@quadrivo.com",
          emailNormalized: "owner@quadrivo.com",
          role: "owner",
          revokedAt: null,
          acceptedAt: null,
          expiresAt: new Date("2099-01-02T00:00:00.000Z"),
          createdAt: new Date("2026-03-24T09:10:00.000Z"),
        },
        {
          id: "invite_1",
          email: "owner@quadrivo.com",
          emailNormalized: "owner@quadrivo.com",
          role: "owner",
          revokedAt: null,
          acceptedAt: null,
          expiresAt: new Date("2099-01-01T00:00:00.000Z"),
          createdAt: new Date("2026-03-24T09:00:00.000Z"),
        },
      ],
      update: async (args) => {
        calls.push(["organizationInvitation.update", args])
        return null
      },
    },
    user: {
      findUnique: async (args) => {
        calls.push(["user.findUnique", args])
        return null
      },
      create: async (args) => {
        calls.push(["user.create", args])
        return {
          id: "user_owner",
          email: args.data.email,
          defaultOrganizationId: args.data.defaultOrganizationId,
        }
      },
      update: async () => {
        throw new Error("no deberia actualizar usuario creado desde cero")
      },
    },
  })

  const report = await runOrganizationOwnerBackfill(
    {
      organizationNames: ["Quadrivo"],
      dryRun: false,
      now: new Date("2026-03-24T10:00:00.000Z"),
    },
    store
  )

  assert.deepEqual(report, {
    scanned: 1,
    eligible: 1,
    backfilled: 1,
    skipped: 0,
    missingOrganizations: [],
    results: [
      {
        organizationId: "org_1",
        organizationName: "Quadrivo",
        status: "backfilled",
        email: "owner@quadrivo.com",
        userId: "user_owner",
      },
    ],
  })

  assert.deepEqual(calls, [
    [
      "user.findUnique",
      {
        where: {
          email: "owner@quadrivo.com",
        },
        select: {
          id: true,
          email: true,
          defaultOrganizationId: true,
        },
      },
    ],
    [
      "user.create",
      {
        data: {
          email: "owner@quadrivo.com",
          name: "owner",
          defaultOrganizationId: "org_1",
        },
      },
    ],
    [
      "membership.upsert",
      {
        where: {
          userId_organizationId: {
            userId: "user_owner",
            organizationId: "org_1",
          },
        },
        update: {
          role: "owner",
        },
        create: {
          userId: "user_owner",
          organizationId: "org_1",
          role: "owner",
        },
      },
    ],
    [
      "organizationInvitation.update",
      {
        where: {
          id: "invite_2",
        },
        data: {
          revokedAt: new Date("2026-03-24T10:00:00.000Z"),
        },
      },
    ],
    [
      "organizationInvitation.update",
      {
        where: {
          id: "invite_1",
        },
        data: {
          revokedAt: new Date("2026-03-24T10:00:00.000Z"),
        },
      },
    ],
  ])
})

test("runOrganizationOwnerBackfill reutiliza usuario existente y fija defaultOrganizationId si faltaba", async () => {
  const calls = []

  const store = createStore({
    organization: {
      findMany: async () => [{ id: "org_2", name: "CUADRIVO2" }],
    },
    membership: {
      findFirst: async () => null,
      upsert: async (args) => {
        calls.push(["membership.upsert", args])
        return null
      },
    },
    organizationInvitation: {
      findMany: async () => [
        {
          id: "invite_3",
          email: "owner2@quadrivo.com",
          emailNormalized: "owner2@quadrivo.com",
          role: "owner",
          revokedAt: null,
          acceptedAt: null,
          expiresAt: new Date("2099-01-03T00:00:00.000Z"),
          createdAt: new Date("2026-03-24T09:20:00.000Z"),
        },
      ],
      update: async (args) => {
        calls.push(["organizationInvitation.update", args])
        return null
      },
    },
    user: {
      findUnique: async (args) => {
        calls.push(["user.findUnique", args])
        return {
          id: "user_existing",
          email: "owner2@quadrivo.com",
          defaultOrganizationId: null,
        }
      },
      create: async () => {
        throw new Error("no deberia crear usuario existente")
      },
      update: async (args) => {
        calls.push(["user.update", args])
        return null
      },
    },
  })

  const report = await runOrganizationOwnerBackfill(
    {
      organizationNames: ["CUADRIVO2"],
      dryRun: false,
      now: new Date("2026-03-24T10:00:00.000Z"),
    },
    store
  )

  assert.deepEqual(report.results, [
    {
      organizationId: "org_2",
      organizationName: "CUADRIVO2",
      status: "backfilled",
      email: "owner2@quadrivo.com",
      userId: "user_existing",
    },
  ])
  assert.deepEqual(calls, [
    [
      "user.findUnique",
      {
        where: {
          email: "owner2@quadrivo.com",
        },
        select: {
          id: true,
          email: true,
          defaultOrganizationId: true,
        },
      },
    ],
    [
      "user.update",
      {
        where: {
          id: "user_existing",
        },
        data: {
          defaultOrganizationId: "org_2",
        },
      },
    ],
    [
      "membership.upsert",
      {
        where: {
          userId_organizationId: {
            userId: "user_existing",
            organizationId: "org_2",
          },
        },
        update: {
          role: "owner",
        },
        create: {
          userId: "user_existing",
          organizationId: "org_2",
          role: "owner",
        },
      },
    ],
    [
      "organizationInvitation.update",
      {
        where: {
          id: "invite_3",
        },
        data: {
          revokedAt: new Date("2026-03-24T10:00:00.000Z"),
        },
      },
    ],
  ])
})

test("runOrganizationOwnerBackfill salta organizaciones con invitaciones owner activas en conflicto", async () => {
  const store = createStore({
    organization: {
      findMany: async () => [{ id: "org_3", name: "Cliente ambiguo" }],
    },
    membership: {
      findFirst: async () => null,
      upsert: async () => {
        throw new Error("no deberia asignar membership con conflicto")
      },
    },
    organizationInvitation: {
      findMany: async () => [
        {
          id: "invite_4",
          email: "owner-a@example.com",
          emailNormalized: "owner-a@example.com",
          role: "owner",
          revokedAt: null,
          acceptedAt: null,
          expiresAt: new Date("2099-01-03T00:00:00.000Z"),
          createdAt: new Date("2026-03-24T09:20:00.000Z"),
        },
        {
          id: "invite_5",
          email: "owner-b@example.com",
          emailNormalized: "owner-b@example.com",
          role: "owner",
          revokedAt: null,
          acceptedAt: null,
          expiresAt: new Date("2099-01-04T00:00:00.000Z"),
          createdAt: new Date("2026-03-24T09:30:00.000Z"),
        },
      ],
      update: async () => {
        throw new Error("no deberia tocar invitaciones con conflicto")
      },
    },
    user: {
      findUnique: async () => {
        throw new Error("no deberia buscar usuario con conflicto")
      },
      create: async () => {
        throw new Error("no deberia crear usuario con conflicto")
      },
      update: async () => {
        throw new Error("no deberia actualizar usuario con conflicto")
      },
    },
  })

  const report = await runOrganizationOwnerBackfill(
    {
      organizationNames: ["Cliente ambiguo"],
      dryRun: false,
      now: new Date("2026-03-24T10:00:00.000Z"),
    },
    store
  )

  assert.deepEqual(report.results, [
    {
      organizationId: "org_3",
      organizationName: "Cliente ambiguo",
      status: "skipped_conflicting_owner_invitations",
    },
  ])
  assert.equal(report.backfilled, 0)
  assert.equal(report.skipped, 1)
})
