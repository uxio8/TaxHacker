import type { PlatformRole } from "../prisma/client/index.js"

export const PLATFORM_ROLE = {
  OWNER: "platform_owner",
  ADMIN: "platform_admin",
  SUPPORT: "platform_support",
  FINANCE: "platform_finance",
} as const

export type SupportedPlatformRole = (typeof PLATFORM_ROLE)[keyof typeof PLATFORM_ROLE]

type PlatformAdminStore = {
  platformAdminAssignment: {
    findMany: (args: {
      where: {
        userId: string
      }
      orderBy: {
        createdAt: "asc" | "desc"
      }
      select: {
        role: true
      }
    }) => Promise<Array<{ role: PlatformRole }>>
    upsert?: (args: {
      where: {
        userId_role: {
          userId: string
          role: PlatformRole
        }
      }
      update: Record<string, never>
      create: {
        userId: string
        role: PlatformRole
      }
    }) => Promise<{ role: PlatformRole }>
  }
}

export function isPlatformRole(role: string): role is SupportedPlatformRole {
  return Object.values(PLATFORM_ROLE).includes(role as SupportedPlatformRole)
}

export async function listPlatformRolesForUser(userId: string, store?: PlatformAdminStore) {
  const db = await resolveStore(store)
  const assignments = await safeFindAssignments(db, userId)

  return assignments.map((assignment) => assignment.role).filter(isPlatformRole)
}

export async function hasPlatformRole(userId: string, role: SupportedPlatformRole, store?: PlatformAdminStore) {
  const roles = await listPlatformRolesForUser(userId, store)
  return roles.includes(role)
}

export async function canAccessOps(userId: string, store?: PlatformAdminStore) {
  const roles = await listPlatformRolesForUser(userId, store)
  return roles.length > 0
}

export async function canAccessPlatformOps(userId: string, store?: PlatformAdminStore) {
  const roles = await listPlatformRolesForUser(userId, store)
  return roles.some((role) =>
    role === PLATFORM_ROLE.OWNER
    || role === PLATFORM_ROLE.ADMIN
    || role === PLATFORM_ROLE.SUPPORT
    || role === PLATFORM_ROLE.FINANCE
  )
}

export async function ensurePlatformRoleAssignment(
  userId: string,
  role: SupportedPlatformRole,
  store?: PlatformAdminStore
) {
  const db = await resolveStore(store)
  const upsert = db.platformAdminAssignment.upsert

  if (!upsert) {
    return false
  }

  try {
    await upsert({
      where: {
        userId_role: {
          userId,
          role,
        },
      },
      update: {},
      create: {
        userId,
        role,
      },
    })

    return true
  } catch (error) {
    if (isMissingPlatformAdminAssignmentsError(error)) {
      return false
    }

    throw error
  }
}

export async function ensureSelfHostedPlatformOwner(userId: string, store?: PlatformAdminStore) {
  return await ensurePlatformRoleAssignment(userId, PLATFORM_ROLE.OWNER, store)
}

async function resolveStore(store?: PlatformAdminStore): Promise<PlatformAdminStore> {
  if (store) {
    return store
  }

  const { prisma } = await import("../lib/db.ts")
  return prisma as unknown as PlatformAdminStore
}

async function safeFindAssignments(store: PlatformAdminStore, userId: string) {
  try {
    return await store.platformAdminAssignment.findMany({
      where: { userId },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        role: true,
      },
    })
  } catch (error) {
    if (isMissingPlatformAdminAssignmentsError(error)) {
      return []
    }

    throw error
  }
}

function isMissingPlatformAdminAssignmentsError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false
  }

  const code = "code" in error && typeof error.code === "string" ? error.code : null
  const message = "message" in error && typeof error.message === "string" ? error.message : ""

  return code === "P2021"
    || message.includes("platform_admin_assignments")
    || message.includes("does not exist in the current database")
}
