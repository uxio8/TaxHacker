import { prisma } from "@/lib/db"
import { codeFromName } from "@/lib/utils"
import { Prisma } from "@/prisma/client"
import { cache } from "react"
import { ensureUserDefaultsVersion } from "./defaults"
import { buildOrganizationOwnedCodeWhere, buildOrganizationOwnedCreateData, buildOrganizationOwnedScope } from "./organization-owned"

export type CategoryData = {
  [key: string]: unknown
}

export const getCategories = cache(async (organizationId: string) => {
  await ensureUserDefaultsVersion(organizationId)

  return await prisma.category.findMany({
    where: buildOrganizationOwnedScope(organizationId),
    orderBy: {
      name: "asc",
    },
  })
})

export const getCategoryByCode = cache(async (organizationId: string, code: string) => {
  return await prisma.category.findUnique({
    where: buildOrganizationOwnedCodeWhere(organizationId, code),
  })
})

export const createCategory = async (organizationId: string, category: CategoryData) => {
  if (!category.code) {
    category.code = codeFromName(category.name as string)
  }
  return await prisma.category.create({
    data: buildOrganizationOwnedCreateData(organizationId, category) as unknown as Prisma.CategoryUncheckedCreateInput,
  })
}

export const updateCategory = async (organizationId: string, code: string, category: CategoryData) => {
  return await prisma.category.update({
    where: buildOrganizationOwnedCodeWhere(organizationId, code),
    data: category,
  })
}

export const deleteCategory = async (organizationId: string, code: string) => {
  await prisma.transaction.updateMany({
    where: {
      userId: organizationId,
      categoryCode: code,
    },
    data: {
      categoryCode: null,
    },
  })

  return await prisma.category.delete({
    where: buildOrganizationOwnedCodeWhere(organizationId, code),
  })
}
