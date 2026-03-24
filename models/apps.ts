import { prisma } from "@/lib/db"
import { Prisma, User } from "@/prisma/client"

export const getAppData = async (user: User, app: string) => {
  const organizationId = user.defaultOrganizationId ?? user.id
  const appData = await prisma.appData.findUnique({
    where: { organizationId_app: { organizationId, app } },
  })

  return appData?.data
}

export const setAppData = async (user: User, app: string, data: unknown) => {
  const organizationId = user.defaultOrganizationId ?? user.id
  await prisma.appData.upsert({
    where: { organizationId_app: { organizationId, app } },
    update: { data: data as Prisma.InputJsonValue },
    create: { userId: user.id, organizationId, app, data: data as Prisma.InputJsonValue },
  })
}
