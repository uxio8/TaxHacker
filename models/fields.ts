import { prisma } from "@/lib/db"
import { codeFromName } from "@/lib/utils"
import { Prisma } from "@/prisma/client"
import { cache } from "react"
import { ensureUserDefaultsVersion } from "./defaults"
import { buildOrganizationOwnedCodeWhere, buildOrganizationOwnedCreateData, buildOrganizationOwnedScope } from "./organization-owned"

export type FieldData = {
  [key: string]: unknown
}

export const getFields = cache(async (organizationId: string) => {
  await ensureUserDefaultsVersion(organizationId)

  return await prisma.field.findMany({
    where: buildOrganizationOwnedScope(organizationId),
    orderBy: {
      createdAt: "asc",
    },
  })
})

export const createField = async (organizationId: string, field: FieldData) => {
  if (!field.code) {
    field.code = codeFromName(field.name as string)
  }
  return await prisma.field.create({
    data: buildOrganizationOwnedCreateData(organizationId, field) as unknown as Prisma.FieldUncheckedCreateInput,
  })
}

export const updateField = async (organizationId: string, code: string, field: FieldData) => {
  return await prisma.field.update({
    where: buildOrganizationOwnedCodeWhere(organizationId, code),
    data: field,
  })
}

export const deleteField = async (organizationId: string, code: string) => {
  return await prisma.field.delete({
    where: buildOrganizationOwnedCodeWhere(organizationId, code),
  })
}
