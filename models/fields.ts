import { prisma } from "@/lib/db"
import { codeFromName } from "@/lib/utils"
import { Prisma } from "@/prisma/client"
import { cache } from "react"
import { ensureUserDefaultsVersion } from "./defaults"

export type FieldData = {
  [key: string]: unknown
}

export const getFields = cache(async (userId: string) => {
  await ensureUserDefaultsVersion(userId)

  return await prisma.field.findMany({
    where: { userId },
    orderBy: {
      createdAt: "asc",
    },
  })
})

export const createField = async (userId: string, field: FieldData) => {
  if (!field.code) {
    field.code = codeFromName(field.name as string)
  }
  return await prisma.field.create({
    data: {
      ...field,
      user: {
        connect: {
          id: userId,
        },
      },
    } as Prisma.FieldCreateInput,
  })
}

export const updateField = async (userId: string, code: string, field: FieldData) => {
  return await prisma.field.update({
    where: { userId_code: { code, userId } },
    data: field,
  })
}

export const deleteField = async (userId: string, code: string) => {
  return await prisma.field.delete({
    where: { userId_code: { code, userId } },
  })
}
