import { prisma } from "@/lib/db"
import { Prisma } from "@/prisma/client"

export const getOrCreateProgress = async (
  userId: string,
  id: string,
  type: string | null = null,
  data: unknown = null,
  total: number = 0,
  organizationId = userId
) => {
  return await prisma.progress.upsert({
    where: { id },
    create: {
      id,
      userId,
      organizationId,
      type: type || "unknown",
      data: data as Prisma.InputJsonValue,
      total,
    },
    update: {
      // Don't update existing progress
    },
  })
}

export const getProgressById = async (userId: string, id: string, organizationId = userId) => {
  return await prisma.progress.findFirst({
    where: { id, userId, organizationId },
  })
}

export const updateProgress = async (
  userId: string,
  id: string,
  fields: { current?: number; total?: number; data?: unknown },
  organizationId = userId
) => {
  return await prisma.progress.updateMany({
    where: { id, userId, organizationId },
    data: {
      ...fields,
      data: fields.data as Prisma.InputJsonValue | undefined,
    },
  })
}

export const incrementProgress = async (userId: string, id: string, amount: number = 1, organizationId = userId) => {
  return await prisma.progress.updateMany({
    where: { id, userId, organizationId },
    data: {
      current: { increment: amount },
    },
  })
}

export const getAllProgressByUser = async (userId: string, organizationId = userId) => {
  return await prisma.progress.findMany({
    where: { userId, organizationId },
    orderBy: { createdAt: "desc" },
  })
}

export const deleteProgress = async (userId: string, id: string, organizationId = userId) => {
  return await prisma.progress.deleteMany({
    where: { id, userId, organizationId },
  })
}
