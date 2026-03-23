import type { Prisma } from "../prisma/client/index.js"

type PlatformAuditStore = {
  platformAuditLog: {
    create: (args: {
      data: Prisma.PlatformAuditLogUncheckedCreateInput
    }) => Promise<unknown>
    findMany: (args: {
      where?: {
        organizationId?: string
        actorUserId?: string
      }
      orderBy: {
        createdAt: "asc" | "desc"
      }
      take?: number
    }) => Promise<
      Array<{
        id: string
        organizationId: string | null
        action: string
        reason: string | null
        createdAt: Date
      }>
    >
  }
}

export type PlatformAuditLogRecord = {
  id: string
  organizationId: string | null
  action: string
  reason: string | null
  createdAt: Date
}

export async function createPlatformAuditLog(
  input: {
    action: string
    actorUserId?: string | null
    targetUserId?: string | null
    organizationId?: string | null
    reason?: string | null
    payload?: Prisma.InputJsonValue
  },
  store?: PlatformAuditStore
) {
  const db = await resolveStore(store)

  return db.platformAuditLog.create({
    data: {
      action: input.action,
      actorUserId: input.actorUserId ?? null,
      targetUserId: input.targetUserId ?? null,
      organizationId: input.organizationId ?? null,
      reason: input.reason ?? null,
      payload: input.payload ?? {},
    },
  })
}

export async function listRecentPlatformAuditLogs(
  input: {
    organizationId?: string
    actorUserId?: string
    limit?: number
  } = {},
  store?: PlatformAuditStore
) {
  const db = await resolveStore(store)

  return (await db.platformAuditLog.findMany({
    where: {
      ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
    take: input.limit ?? 20,
  })) as PlatformAuditLogRecord[]
}

async function resolveStore(store?: PlatformAuditStore): Promise<PlatformAuditStore> {
  if (store) {
    return store
  }

  const { prisma } = await import("../lib/db.ts")
  return prisma as unknown as PlatformAuditStore
}
