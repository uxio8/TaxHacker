import { buildDefaultUserNameFromEmail } from "./organizations.ts"

type BackfillOrganizationRecord = {
  id: string
  name: string
}

type BackfillUserRecord = {
  id: string
  email: string
  defaultOrganizationId: string | null
}

type BackfillInvitationRecord = {
  id: string
  email: string
  emailNormalized: string
  role: "owner"
  revokedAt: Date | null
  acceptedAt: Date | null
  expiresAt: Date
  createdAt: Date
}

type BackfillStore = {
  organization: {
    findMany: (args: {
      where?: unknown
      select?: {
        id: true
        name: true
      }
    }) => Promise<BackfillOrganizationRecord[]>
  }
  user: {
    findUnique: (args: {
      where: {
        email: string
      }
      select: {
        id: true
        email: true
        defaultOrganizationId: true
      }
    }) => Promise<BackfillUserRecord | null>
    create: (args: {
      data: {
        email: string
        name: string
        defaultOrganizationId: string
      }
    }) => Promise<BackfillUserRecord>
    update: (args: {
      where: {
        id: string
      }
      data: {
        defaultOrganizationId: string
      }
    }) => Promise<unknown>
  }
  membership: {
    findFirst: (args: {
      where: {
        organizationId: string
        role: "owner"
      }
      select?: {
        id: true
      }
    }) => Promise<{ id: string } | null>
    upsert: (args: {
      where: {
        userId_organizationId: {
          userId: string
          organizationId: string
        }
      }
      update: {
        role: "owner"
      }
      create: {
        userId: string
        organizationId: string
        role: "owner"
      }
    }) => Promise<unknown>
  }
  organizationInvitation: {
    findMany: (args: {
      where: unknown
      orderBy?: {
        createdAt: "asc" | "desc"
      }
      select?: {
        id: true
        email: true
        emailNormalized: true
        role: true
        revokedAt: true
        acceptedAt: true
        expiresAt: true
        createdAt: true
      }
    }) => Promise<BackfillInvitationRecord[]>
    update: (args: {
      where: {
        id: string
      }
      data: {
        revokedAt: Date
      }
    }) => Promise<unknown>
  }
  $transaction?: <T>(callback: (tx: BackfillStore) => Promise<T>) => Promise<T>
}

type BackfillOptions = {
  organizationNames: string[]
  dryRun?: boolean
  now?: Date
}

type BackfillResult =
  | {
      organizationId: string
      organizationName: string
      status: "eligible_dry_run"
      email: string
    }
  | {
      organizationId: string
      organizationName: string
      status: "backfilled"
      email: string
      userId: string
    }
  | {
      organizationId: string
      organizationName: string
      status: "skipped_has_owner" | "skipped_missing_owner_invitation" | "skipped_conflicting_owner_invitations"
    }

type BackfillReport = {
  scanned: number
  eligible: number
  backfilled: number
  skipped: number
  missingOrganizations: string[]
  results: BackfillResult[]
}

export { buildDefaultUserNameFromEmail }

export async function runOrganizationOwnerBackfill(options: BackfillOptions, store?: BackfillStore): Promise<BackfillReport> {
  const db = await resolveStore(store)
  const now = options.now ?? new Date()
  const { normalizedNames, originalNamesByNormalized } = normalizeOrganizationNames(options.organizationNames)
  const organizations = await findOrganizationsByName(normalizedNames, db)
  const foundByName = new Map(organizations.map((organization) => [organization.name.trim().toLowerCase(), organization]))
  const missingOrganizations = normalizedNames
    .filter((name) => !foundByName.has(name))
    .map((name) => originalNamesByNormalized.get(name) ?? name)

  const report: BackfillReport = {
    scanned: organizations.length,
    eligible: 0,
    backfilled: 0,
    skipped: 0,
    missingOrganizations,
    results: [],
  }

  for (const organization of organizations) {
    const runner = db.$transaction
      ? async () => await db.$transaction!(async (tx) => await backfillOrganization(organization, options, tx, now))
      : async () => await backfillOrganization(organization, options, db, now)

    const result = await runner()
    report.results.push(result)

    if (result.status === "eligible_dry_run") {
      report.eligible += 1
      continue
    }

    if (result.status === "backfilled") {
      report.eligible += 1
      report.backfilled += 1
      continue
    }

    report.skipped += 1
  }

  return report
}

async function backfillOrganization(
  organization: BackfillOrganizationRecord,
  options: BackfillOptions,
  store: BackfillStore,
  now: Date
): Promise<BackfillResult> {
  const existingOwner = await store.membership.findFirst({
    where: {
      organizationId: organization.id,
      role: "owner",
    },
    select: {
      id: true,
    },
  })

  if (existingOwner) {
    return {
      organizationId: organization.id,
      organizationName: organization.name,
      status: "skipped_has_owner",
    }
  }

  const pendingOwnerInvitations = await store.organizationInvitation.findMany({
    where: {
      organizationId: organization.id,
      role: "owner",
      revokedAt: null,
      acceptedAt: null,
      expiresAt: {
        gt: now,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      email: true,
      emailNormalized: true,
      role: true,
      revokedAt: true,
      acceptedAt: true,
      expiresAt: true,
      createdAt: true,
    },
  })

  if (pendingOwnerInvitations.length === 0) {
    return {
      organizationId: organization.id,
      organizationName: organization.name,
      status: "skipped_missing_owner_invitation",
    }
  }

  const uniqueEmails = new Set(pendingOwnerInvitations.map((invitation) => invitation.emailNormalized))
  if (uniqueEmails.size > 1) {
    return {
      organizationId: organization.id,
      organizationName: organization.name,
      status: "skipped_conflicting_owner_invitations",
    }
  }

  const selectedInvitation = pendingOwnerInvitations[0]

  if (options.dryRun) {
    return {
      organizationId: organization.id,
      organizationName: organization.name,
      status: "eligible_dry_run",
      email: selectedInvitation.emailNormalized,
    }
  }

  const existingUser = await store.user.findUnique({
    where: {
      email: selectedInvitation.emailNormalized,
    },
    select: {
      id: true,
      email: true,
      defaultOrganizationId: true,
    },
  })

  const user = existingUser
    ?? await store.user.create({
      data: {
        email: selectedInvitation.emailNormalized,
        name: buildDefaultUserNameFromEmail(selectedInvitation.emailNormalized),
        defaultOrganizationId: organization.id,
      },
    })

  if (existingUser && !existingUser.defaultOrganizationId) {
    await store.user.update({
      where: {
        id: existingUser.id,
      },
      data: {
        defaultOrganizationId: organization.id,
      },
    })
  }

  await store.membership.upsert({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: organization.id,
      },
    },
    update: {
      role: "owner",
    },
    create: {
      userId: user.id,
      organizationId: organization.id,
      role: "owner",
    },
  })

  for (const invitation of pendingOwnerInvitations) {
    await store.organizationInvitation.update({
      where: {
        id: invitation.id,
      },
      data: {
        revokedAt: now,
      },
    })
  }

  return {
    organizationId: organization.id,
    organizationName: organization.name,
    status: "backfilled",
    email: selectedInvitation.emailNormalized,
    userId: user.id,
  }
}

async function findOrganizationsByName(
  requestedNames: string[],
  store: BackfillStore
) {
  if (requestedNames.length === 0) {
    return []
  }

  return await store.organization.findMany({
    where: {
      OR: requestedNames.map((name) => ({
        name: {
          equals: name,
          mode: "insensitive",
        },
      })),
    },
    select: {
      id: true,
      name: true,
    },
  })
}

function normalizeOrganizationNames(names: string[]) {
  const uniqueNames = new Set<string>()
  const originalNamesByNormalized = new Map<string, string>()

  for (const name of names) {
    const normalized = name.trim().toLowerCase()
    if (normalized) {
      uniqueNames.add(normalized)
      if (!originalNamesByNormalized.has(normalized)) {
        originalNamesByNormalized.set(normalized, name.trim())
      }
    }
  }

  return {
    normalizedNames: [...uniqueNames],
    originalNamesByNormalized,
  }
}

async function resolveStore(store?: BackfillStore): Promise<BackfillStore> {
  if (store) {
    return store
  }

  const { prisma } = await import("../lib/db.ts")
  return prisma as unknown as BackfillStore
}
