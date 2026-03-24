import { MEMBERSHIP_ROLE, type MembershipRole } from "../lib/membership-roles.ts"

type MembershipRecord = {
  id: string
  userId: string
  organizationId: string
  role: MembershipRole
}

type MembershipStore = {
  membership: {
    findUnique: (args: {
      where: {
        userId_organizationId: {
          userId: string
          organizationId: string
        }
      }
    }) => Promise<MembershipRecord | null>
    findMany: (args: unknown) => Promise<unknown[]>
    upsert: (args: {
      where: {
        userId_organizationId: {
          userId: string
          organizationId: string
        }
      }
      update: {
        role: MembershipRole
      }
      create: {
        userId: string
        organizationId: string
        role: MembershipRole
      }
    }) => Promise<MembershipRecord>
    update: (args: {
      where: {
        userId_organizationId: {
          userId: string
          organizationId: string
        }
      }
      data: {
        role: MembershipRole
      }
    }) => Promise<MembershipRecord>
    deleteMany: (args: {
      where: {
        userId: string
        organizationId: string
      }
    }) => Promise<{ count: number }>
  }
}

async function resolveStore(store?: MembershipStore): Promise<MembershipStore> {
  if (store) {
    return store
  }

  const { prisma } = await import("../lib/db.ts")
  return prisma as unknown as MembershipStore
}

function isMembershipRole(role: string): role is MembershipRole {
  return Object.values(MEMBERSHIP_ROLE).includes(role as MembershipRole)
}

function assertMembershipRole(role: string): asserts role is MembershipRole {
  if (!isMembershipRole(role)) {
    throw new Error(`Role invalido: ${role}`)
  }
}

export async function getMembershipByUserAndOrganization(
  userId: string,
  organizationId: string,
  store?: MembershipStore
) {
  const db = await resolveStore(store)

  return await db.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
  })
}

export async function listMembershipsByUserId(userId: string, store?: MembershipStore) {
  const db = await resolveStore(store)

  return (await db.membership.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  })) as MembershipRecord[]
}

export async function upsertMembership(
  userId: string,
  organizationId: string,
  role: MembershipRole,
  store?: MembershipStore
) {
  const db = await resolveStore(store)
  assertMembershipRole(role)
  const existingMembership = await db.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
  })

  if (existingMembership?.role === MEMBERSHIP_ROLE.OWNER && role !== MEMBERSHIP_ROLE.OWNER) {
    await assertOrganizationKeepsAnotherOwner(organizationId, userId, db)
  }

  return await db.membership.upsert({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
    update: {
      role,
    },
    create: {
      userId,
      organizationId,
      role,
    },
  })
}

type OrganizationMemberRecord = MembershipRecord & {
  user: {
    id?: string
    email: string | null
    name: string | null
  } | null
}

export async function listMembersByOrganizationId(organizationId: string, store?: MembershipStore) {
  const db = await resolveStore(store)

  return (await db.membership.findMany({
    where: { organizationId },
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
  })) as OrganizationMemberRecord[]
}

export async function listOwnerMembersByOrganizationId(organizationId: string, store?: MembershipStore) {
  const db = await resolveStore(store)

  return (await db.membership.findMany({
    where: {
      organizationId,
      role: MEMBERSHIP_ROLE.OWNER,
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      userId: true,
      organizationId: true,
      role: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  })) as OrganizationMemberRecord[]
}

export async function deleteMembership(userId: string, organizationId: string, store?: MembershipStore) {
  const db = await resolveStore(store)
  const membership = await db.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
  })

  if (membership?.role === MEMBERSHIP_ROLE.OWNER) {
    await assertOrganizationKeepsAnotherOwner(organizationId, userId, db)
  }

  const result = await db.membership.deleteMany({
    where: {
      userId,
      organizationId,
    },
  })

  return result.count
}

export async function setMembershipRole(
  userId: string,
  organizationId: string,
  role: MembershipRole,
  store?: MembershipStore
) {
  const db = await resolveStore(store)
  assertMembershipRole(role)

  return await db.membership.update({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
    data: {
      role,
    },
  })
}

export async function transferOrganizationOwnership(
  input: {
    organizationId: string
    currentOwnerUserId: string
    nextOwnerUserId: string
  },
  store?: MembershipStore
) {
  const db = await resolveStore(store)
  const nextOwnerMembership = await db.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: input.nextOwnerUserId,
        organizationId: input.organizationId,
      },
    },
  })

  if (!nextOwnerMembership) {
    throw new Error("La nueva persona propietaria debe pertenecer ya a la organización")
  }

  await db.membership.update({
    where: {
      userId_organizationId: {
        userId: input.currentOwnerUserId,
        organizationId: input.organizationId,
      },
    },
    data: {
      role: MEMBERSHIP_ROLE.ADMIN,
    },
  })

  return await db.membership.update({
    where: {
      userId_organizationId: {
        userId: input.nextOwnerUserId,
        organizationId: input.organizationId,
      },
    },
    data: {
      role: MEMBERSHIP_ROLE.OWNER,
    },
  })
}

type MembershipUserIdentityRecord = {
  user: {
    id: string
    email: string | null
  } | null
}

export async function listMembershipUserNamespacesByOrganizationId(
  organizationId: string,
  store?: MembershipStore
) {
  const db = await resolveStore(store)
  const memberships = (await db.membership.findMany({
    where: { organizationId },
    select: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  })) as MembershipUserIdentityRecord[]

  return Array.from(
    new Set(
      memberships.flatMap((membership) => {
        if (!membership.user) {
          return []
        }

        return [membership.user.id, membership.user.email].filter((value): value is string => Boolean(value))
      })
    )
  )
}

async function assertOrganizationKeepsAnotherOwner(
  organizationId: string,
  excludedUserId: string,
  store: MembershipStore
) {
  const ownerMemberships = (await store.membership.findMany({
    where: {
      organizationId,
      role: MEMBERSHIP_ROLE.OWNER,
    },
    select: {
      userId: true,
    },
  })) as Array<{ userId: string }>

  const remainingOwnerCount = ownerMemberships.filter((membership) => membership.userId !== excludedUserId).length
  if (remainingOwnerCount === 0) {
    throw new Error("La organización debe conservar al menos una persona owner")
  }
}
