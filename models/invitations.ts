import { randomUUID } from "node:crypto"

import type { Role } from "../prisma/client/index.js"

type InvitationRecord = {
  id: string
  organizationId: string
  email?: string
  emailNormalized: string
  role: Role
  token: string
  expiresAt: Date
  acceptedAt: Date | null
  revokedAt: Date | null
}

type InvitationStore = {
  organizationInvitation: {
    create: (args: {
      data: {
        organizationId: string
        email: string
        emailNormalized: string
        role: Role
        token: string
        invitedByUserId: string
        expiresAt: Date
      }
    }) => Promise<InvitationRecord>
    findUnique: (args: {
      where: {
        token: string
      }
    }) => Promise<InvitationRecord | null>
    update: (args: {
      where: {
        token: string
      }
      data: {
        acceptedAt?: Date
        acceptedByUserId?: string
        revokedAt?: Date
      }
    }) => Promise<unknown>
    findMany: (args: {
      where: {
        organizationId: string
      }
      orderBy: {
        createdAt: "asc" | "desc"
      }
    }) => Promise<InvitationRecord[]>
  }
  membership: {
    upsert: (args: {
      where: {
        userId_organizationId: {
          userId: string
          organizationId: string
        }
      }
      update: {
        role: Role
      }
      create: {
        userId: string
        organizationId: string
        role: Role
      }
    }) => Promise<unknown>
  }
  user: {
    update: (args: {
      where: {
        id: string
      }
      data: {
        defaultOrganizationId: string
      }
    }) => Promise<unknown>
  }
}

type InvitationOptions = {
  store?: InvitationStore
  tokenFactory?: () => string
  now?: Date
}

export function buildInvitationToken() {
  return randomUUID()
}

export async function createOrganizationInvitation(
  input: {
    organizationId: string
    email: string
    role: Role
    invitedByUserId: string
    expiresAt: Date
  },
  options: InvitationOptions = {}
) {
  const db = await resolveStore(options.store)
  const token = (options.tokenFactory ?? buildInvitationToken)()
  const emailNormalized = normalizeInvitationEmail(input.email)

  return await db.organizationInvitation.create({
    data: {
      organizationId: input.organizationId,
      email: input.email.trim(),
      emailNormalized,
      role: input.role,
      token,
      invitedByUserId: input.invitedByUserId,
      expiresAt: input.expiresAt,
    },
  })
}

export async function listOrganizationInvitations(organizationId: string, store?: InvitationStore) {
  const db = await resolveStore(store)

  return await db.organizationInvitation.findMany({
    where: { organizationId },
    orderBy: {
      createdAt: "desc",
    },
  })
}

export async function revokeOrganizationInvitation(
  input: {
    token: string
    revokedAt?: Date
  },
  store?: InvitationStore
) {
  const db = await resolveStore(store)

  await db.organizationInvitation.update({
    where: { token: input.token },
    data: {
      revokedAt: input.revokedAt ?? new Date(),
    },
  })
}

export async function acceptOrganizationInvitation(
  input: {
    token: string
    userId: string
    userEmail: string
  },
  options: InvitationOptions = {}
) {
  const db = await resolveStore(options.store)
  const now = options.now ?? new Date()
  const invitation = await db.organizationInvitation.findUnique({
    where: {
      token: input.token,
    },
  })

  if (!invitation) {
    return { accepted: false, reason: "not_found" as const }
  }

  if (invitation.acceptedAt) {
    return { accepted: false, reason: "already_accepted" as const }
  }

  if (invitation.revokedAt) {
    return { accepted: false, reason: "revoked" as const }
  }

  if (invitation.expiresAt <= now) {
    return { accepted: false, reason: "expired" as const }
  }

  if (normalizeInvitationEmail(input.userEmail) !== invitation.emailNormalized) {
    return { accepted: false, reason: "email_mismatch" as const }
  }

  await db.membership.upsert({
    where: {
      userId_organizationId: {
        userId: input.userId,
        organizationId: invitation.organizationId,
      },
    },
    update: {
      role: invitation.role,
    },
    create: {
      userId: input.userId,
      organizationId: invitation.organizationId,
      role: invitation.role,
    },
  })

  await db.user.update({
    where: { id: input.userId },
    data: {
      defaultOrganizationId: invitation.organizationId,
    },
  })

  await db.organizationInvitation.update({
    where: { token: input.token },
    data: {
      acceptedAt: now,
      acceptedByUserId: input.userId,
    },
  })

  return {
    accepted: true as const,
    organizationId: invitation.organizationId,
    role: invitation.role,
  }
}

export function normalizeInvitationEmail(email: string) {
  return email.trim().toLowerCase()
}

async function resolveStore(store?: InvitationStore): Promise<InvitationStore> {
  if (store) {
    return store
  }

  const { prisma } = await import("../lib/db.ts")
  return prisma as unknown as InvitationStore
}
