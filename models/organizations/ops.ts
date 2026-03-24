import { randomUUID } from "node:crypto"

import { createOrganizationInvitation } from "../invitations.ts"
import type { Role } from "../../prisma/client/index.js"
import { normalizeInitialUsers, resolveStore } from "./runtime.ts"
import type {
  CreateOrganizationForOpsInput,
  CreateOrganizationForOpsOptions,
  CreateOrganizationForOpsResult,
  OrganizationLookupUser,
  OrganizationStore,
  ProvisionOrganizationAccessResult,
} from "./types.ts"

async function provisionOrganizationAccess(
  input: {
    organizationId: string
    email: string
    role: Role
    actorUserId: string
  },
  options: {
    store: OrganizationStore
    tokenFactory?: () => string
    now: Date
  }
): Promise<ProvisionOrganizationAccessResult> {
  const normalizedEmail = input.email.trim().toLowerCase()
  const user = await options.store.user.findUnique({
    where: {
      email: normalizedEmail,
    },
    select: {
      id: true,
      email: true,
    },
  }) as OrganizationLookupUser | null

  if (user) {
    await options.store.membership.upsert({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: input.organizationId,
        },
      },
      update: {
        role: input.role,
      },
      create: {
        userId: user.id,
        organizationId: input.organizationId,
        role: input.role,
      },
    })

    return {
      type: "existing_user",
      userId: user.id,
      email: user.email,
      role: input.role,
    }
  }

  const invitation = await createOrganizationInvitation(
    {
      organizationId: input.organizationId,
      email: normalizedEmail,
      role: input.role,
      invitedByUserId: input.actorUserId,
      expiresAt: new Date(options.now.getTime() + 1000 * 60 * 60 * 24 * 14),
    },
    {
      store: options.store as never,
      tokenFactory: options.tokenFactory,
      now: options.now,
    }
  )

  return {
    type: "invited_email",
    email: invitation.emailNormalized,
    invitationToken: invitation.token,
    role: input.role,
  }
}

async function createOrganizationForOpsWithStore(
  input: CreateOrganizationForOpsInput,
  store: OrganizationStore,
  options: CreateOrganizationForOpsOptions = {}
): Promise<CreateOrganizationForOpsResult> {
  const now = options.now ?? new Date()
  const organizationId = (options.idFactory ?? randomUUID)()
  const organizationName = input.name.trim()
  const ownerEmail = input.ownerEmail.trim().toLowerCase()
  const initialUsers = normalizeInitialUsers(input.initialUsers ?? [], ownerEmail)

  const organization = await store.organization.create({
    data: {
      id: organizationId,
      name: organizationName,
    },
  })

  const ownerAccess = await provisionOrganizationAccess(
    {
      organizationId: organization.id,
      email: ownerEmail,
      role: "owner",
      actorUserId: input.actorUserId,
    },
    {
      store,
      tokenFactory: options.tokenFactory,
      now,
    }
  )

  const createdInitialUsers: CreateOrganizationForOpsResult["initialUsers"] = []

  for (const initialUser of initialUsers) {
    const provisioned = await provisionOrganizationAccess(
      {
        organizationId: organization.id,
        email: initialUser.email,
        role: initialUser.role,
        actorUserId: input.actorUserId,
      },
      {
        store,
        tokenFactory: options.tokenFactory,
        now,
      }
    )

    if (provisioned.type === "existing_user") {
      createdInitialUsers.push({
        type: "existing_user",
        userId: provisioned.userId,
        email: provisioned.email,
        role: initialUser.role,
      })
      continue
    }

    createdInitialUsers.push({
      type: "invited_email",
      email: provisioned.email,
      invitationToken: provisioned.invitationToken,
      role: initialUser.role,
    })
  }

  return {
    organization,
    owner:
      ownerAccess.type === "existing_user"
        ? {
            type: "existing_user",
            userId: ownerAccess.userId,
            email: ownerAccess.email,
          }
        : {
            type: "invited_email",
            email: ownerAccess.email,
            invitationToken: ownerAccess.invitationToken,
          },
    initialUsers: createdInitialUsers,
  }
}

export async function createOrganizationForOps(
  input: CreateOrganizationForOpsInput,
  store?: OrganizationStore,
  options: CreateOrganizationForOpsOptions = {}
) {
  const db = await resolveStore(store)

  if (!store && db.$transaction) {
    return await db.$transaction(async (tx) => {
      return await createOrganizationForOpsWithStore(input, tx as OrganizationStore, options)
    })
  }

  return await createOrganizationForOpsWithStore(input, db, options)
}
