import { prisma } from "@/lib/db"
import { codeFromName } from "@/lib/utils"
import { Prisma } from "@/prisma/client"
import { cache } from "react"
import { ensureUserDefaultsVersion } from "./defaults"
import { buildOrganizationOwnedCodeWhere, buildOrganizationOwnedCreateData, buildOrganizationOwnedScope } from "./organization-owned"

export type ProjectData = {
  [key: string]: unknown
}

export const getProjects = cache(async (organizationId: string) => {
  await ensureUserDefaultsVersion(organizationId)

  return await prisma.project.findMany({
    where: buildOrganizationOwnedScope(organizationId),
    orderBy: {
      name: "asc",
    },
  })
})

export const getProjectByCode = cache(async (organizationId: string, code: string) => {
  return await prisma.project.findUnique({
    where: buildOrganizationOwnedCodeWhere(organizationId, code),
  })
})

export const createProject = async (organizationId: string, project: ProjectData) => {
  if (!project.code) {
    project.code = codeFromName(project.name as string)
  }
  return await prisma.project.create({
    data: buildOrganizationOwnedCreateData(organizationId, project) as unknown as Prisma.ProjectUncheckedCreateInput,
  })
}

export const updateProject = async (organizationId: string, code: string, project: ProjectData) => {
  return await prisma.project.update({
    where: buildOrganizationOwnedCodeWhere(organizationId, code),
    data: project,
  })
}

export const deleteProject = async (organizationId: string, code: string) => {
  await prisma.transaction.updateMany({
    where: {
      userId: organizationId,
      projectCode: code,
    },
    data: {
      projectCode: null,
    },
  })

  return await prisma.project.delete({
    where: buildOrganizationOwnedCodeWhere(organizationId, code),
  })
}
