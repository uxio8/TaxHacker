"use server"

import { getUserUploadsDirectory } from "@/lib/files"
import { deleteStoredFile } from "@/lib/storage/runtime"
import { prisma } from "@/lib/db"
import { Prisma } from "@/prisma/client"
import { getTransactionById } from "./transactions"
import { getUserById } from "./users"

export const getUnsortedFiles = async (organizationId: string) => {
  return await prisma.file.findMany({
    where: {
      isReviewed: false,
      organizationId,
    },
    orderBy: {
      createdAt: "desc",
    },
  })
}

export const getUnsortedFilesCount = async (organizationId: string) => {
  return await prisma.file.count({
    where: {
      isReviewed: false,
      organizationId,
    },
  })
}

export const getFileById = async (id: string, organizationId: string) => {
  return await prisma.file.findFirst({
    where: { id, organizationId },
  })
}

export const getFilesByTransactionId = async (id: string, organizationId: string) => {
  const transaction = await getTransactionById(id, organizationId)
  if (transaction && transaction.files) {
    return await prisma.file.findMany({
      where: {
        id: {
          in: transaction.files as string[],
        },
        organizationId,
      },
      orderBy: {
        createdAt: "asc",
      },
    })
  }
  return []
}

export const createFile = async (userId: string, data: Record<string, unknown>) => {
  const organizationId = typeof data.organizationId === "string" ? data.organizationId : userId

  return await prisma.file.create({
    data: {
      ...data,
      userId,
      organizationId,
    } as Prisma.FileUncheckedCreateInput,
  })
}

export const updateFile = async (id: string, organizationId: string, data: Record<string, unknown>) => {
  await prisma.file.updateMany({
    where: { id, organizationId },
    data,
  })

  return getFileById(id, organizationId)
}

export const deleteFile = async (id: string, organizationId: string) => {
  const file = await getFileById(id, organizationId)
  if (!file) {
    return
  }

  try {
    const user = await getUserById(file.userId)
    if (user) {
      await deleteStoredFile({
        ownerOrganizationId: file.organizationId,
        ownerUploadsDirectory: getUserUploadsDirectory(user),
        storedPath: file.path,
      })
    }
  } catch (error) {
    console.error("Error deleting file:", error)
  }

  await prisma.file.deleteMany({
    where: { id, organizationId },
  })

  return file
}
