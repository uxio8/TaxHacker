import type { SupportAccessMode } from "../prisma/client/index.js"

type SupportAccessSessionRecord = {
  id: string
  organizationId: string
  userId: string
  assumedUserId?: string | null
  mode: SupportAccessMode
  reason: string
  expiresAt: Date
  revokedAt: Date | null
}

export type SupportAccessSessionListRecord = SupportAccessSessionRecord & {
  createdAt: Date
  user: {
    email: string | null
    name: string | null
  } | null
  assumedUser?: {
    id: string
    email: string | null
    name: string | null
  } | null
  organization: {
    id?: string
    name: string
  } | null
}

export type ActiveSupportAccessSessionRecord = SupportAccessSessionRecord

export type ActiveSupportOrganizationRecord = {
  id: string
  name: string
  mode: SupportAccessMode
}

type SupportAccessStore = {
  supportAccessSession: {
    create: (args: {
      data: {
        organizationId: string
        userId: string
        assumedUserId?: string | null
        mode: SupportAccessMode
        reason: string
        expiresAt: Date
      }
    }) => Promise<SupportAccessSessionRecord>
    update: (args: {
      where: {
        id: string
      }
      data: {
        revokedAt: Date
      }
    }) => Promise<SupportAccessSessionRecord>
    findMany: (args: {
      where?: {
        organizationId?: string
        userId?: string
        revokedAt?: null
        expiresAt?: {
          gt: Date
        }
      }
      orderBy: {
        createdAt: "asc" | "desc"
      }
      take?: number
      include?: {
        user: {
          select: {
            email: true
            name: true
          }
        }
        assumedUser?: {
          select: {
            id: true
            email: true
            name: true
          }
        }
        organization: {
          select: {
            id?: true
            name: true
          }
        }
      }
    }) => Promise<unknown[]>
    findFirst: (args: {
      where: {
        id?: string
        organizationId?: string
        userId: string
        revokedAt: null
        expiresAt: {
          gt: Date
        }
      }
      orderBy: {
        createdAt: "desc"
      }
    }) => Promise<SupportAccessSessionRecord | null>
  }
}

export async function createSupportAccessSession(
  input: {
    organizationId: string
    userId: string
    assumedUserId?: string | null
    mode: SupportAccessMode
    reason: string
    expiresAt: Date
  },
  store?: SupportAccessStore
) {
  const db = await resolveStore(store)

  return db.supportAccessSession.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      assumedUserId: input.assumedUserId ?? null,
      mode: input.mode,
      reason: input.reason,
      expiresAt: input.expiresAt,
    },
  })
}

export async function revokeSupportAccessSession(
  input: {
    sessionId: string
    revokedAt?: Date
  },
  store?: SupportAccessStore
) {
  const db = await resolveStore(store)

  return db.supportAccessSession.update({
    where: {
      id: input.sessionId,
    },
    data: {
      revokedAt: input.revokedAt ?? new Date(),
    },
  })
}

export async function listSupportAccessSessions(
  input: {
    organizationId?: string
    userId?: string
    activeOnly?: boolean
    limit?: number
  } = {},
  store?: SupportAccessStore
) {
  const db = await resolveStore(store)
  const now = new Date()

  return (await db.supportAccessSession.findMany({
    where: {
      ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.activeOnly
        ? {
            revokedAt: null,
            expiresAt: {
              gt: now,
            },
          }
        : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
    take: input.limit ?? 20,
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
      assumedUser: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      organization: {
        select: {
          name: true,
        },
      },
    },
  })) as SupportAccessSessionListRecord[]
}

export async function getActiveSupportAccessSession(
  input: {
    organizationId: string
    userId: string
  },
  store?: SupportAccessStore
) {
  const db = await resolveStore(store)

  return await db.supportAccessSession.findFirst({
    where: {
      organizationId: input.organizationId,
      userId: input.userId,
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  })
}

export async function getActiveSupportAccessSessionByIdForUser(
  input: {
    sessionId: string
    userId: string
  },
  store?: SupportAccessStore
) {
  const db = await resolveStore(store)

  return await db.supportAccessSession.findFirst({
    where: {
      id: input.sessionId,
      userId: input.userId,
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  })
}

export async function hasActiveSupportAccess(
  input: {
    organizationId: string
    userId: string
  },
  store?: SupportAccessStore
) {
  const session = await getActiveSupportAccessSession(input, store)
  return Boolean(session)
}

export async function listActiveSupportOrganizationsForUser(
  userId: string,
  store?: SupportAccessStore
) {
  const db = await resolveStore(store)

  const sessions = (await db.supportAccessSession.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
      assumedUser: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })) as SupportAccessSessionListRecord[]

  const organizations = new Map<string, ActiveSupportOrganizationRecord>()

  for (const session of sessions) {
    if (!session.organization?.id || organizations.has(session.organizationId)) {
      continue
    }

    organizations.set(session.organizationId, {
      id: session.organization.id,
      name: session.organization.name,
      mode: session.mode,
    })
  }

  return [...organizations.values()]
}

async function resolveStore(store?: SupportAccessStore): Promise<SupportAccessStore> {
  if (store) {
    return store
  }

  const { prisma } = await import("../lib/db.ts")
  return prisma as unknown as SupportAccessStore
}
