import type { Prisma, User } from "../prisma/client/index.js"
import { cache } from "react"

type UserBootstrapStore = {
  user: {
    findFirst: (args: {
      where: {
        email?: string
        stripeCustomerId?: string
      }
    }) => Promise<User | null>
    upsert: (args: {
      where: {
        email: string
      }
      update: Prisma.UserCreateInput
      create: Prisma.UserCreateInput
    }) => Promise<User>
    findUnique: (args: {
      where: {
        id?: string
        email?: string
      }
    }) => Promise<User | null>
    update: (args: {
      where: {
        id: string
      }
      data: Prisma.UserUpdateInput
    }) => Promise<unknown>
  }
}

type UserRuntimeDependencies = {
  prisma?: UserBootstrapStore
  ensureOrganizationBootstrapForUser?: (userId: string) => Promise<unknown>
  ensureOrganizationBillingBootstrapForUser?: (
    user: Pick<
      User,
      | "id"
      | "defaultOrganizationId"
      | "membershipPlan"
      | "membershipExpiresAt"
      | "stripeCustomerId"
      | "storageLimit"
      | "storageUsed"
      | "aiBalance"
    >,
    organizationId: string
  ) => Promise<unknown>
  ensureSelfHostedPlatformOwner?: (userId: string) => Promise<unknown>
  isDatabaseEmpty?: (userId: string) => Promise<boolean>
  createUserDefaults?: (userId: string) => Promise<unknown>
}

export const SELF_HOSTED_USER = {
  email: "taxhacker@localhost",
  name: "Self-Hosted Mode",
  membershipPlan: "unlimited",
}

export const getSelfHostedUser = cache(async (dependencies: UserRuntimeDependencies = {}) => {
  if (!process.env.DATABASE_URL) {
    return null // fix for CI, do not remove
  }

  const runtime = await resolveRuntimeDependencies(dependencies)
  const user = await runtime.prisma.user.findFirst({
    where: { email: SELF_HOSTED_USER.email },
  })

  if (!user) {
    return null
  }

  await runtime.ensureOrganizationBootstrapForUser(user.id)
  await runtime.ensureSelfHostedPlatformOwner(user.id)

  const refreshedUser = (await runtime.prisma.user.findUnique({
    where: { id: user.id },
  })) ?? user

  if (refreshedUser.defaultOrganizationId) {
    await runtime.ensureOrganizationBillingBootstrapForUser(refreshedUser, refreshedUser.defaultOrganizationId)
  }

  return refreshedUser
})

export const getOrCreateSelfHostedUser = cache(async (dependencies: UserRuntimeDependencies = {}) => {
  const runtime = await resolveRuntimeDependencies(dependencies)
  const user = await runtime.prisma.user.upsert({
    where: { email: SELF_HOSTED_USER.email },
    update: SELF_HOSTED_USER,
    create: SELF_HOSTED_USER,
  })

  await runtime.ensureOrganizationBootstrapForUser(user.id)
  await runtime.ensureSelfHostedPlatformOwner(user.id)

  const refreshedUser = (await runtime.prisma.user.findUnique({
    where: { id: user.id },
  })) ?? user

  if (refreshedUser.defaultOrganizationId) {
    await runtime.ensureOrganizationBillingBootstrapForUser(refreshedUser, refreshedUser.defaultOrganizationId)
  }

  return refreshedUser
})

export async function getOrCreateCloudUser(
  email: string,
  data: Prisma.UserCreateInput,
  dependencies: UserRuntimeDependencies = {}
) {
  const runtime = await resolveRuntimeDependencies(dependencies)
  const db = runtime.prisma

  const user = await db.user.upsert({
    where: { email: email.toLowerCase() },
    update: data,
    create: data,
  })

  await runtime.ensureOrganizationBootstrapForUser(user.id)

  const refreshedUser = (await db.user.findUnique({
    where: { id: user.id },
  })) ?? user

  if (refreshedUser.defaultOrganizationId) {
    await runtime.ensureOrganizationBillingBootstrapForUser(refreshedUser, refreshedUser.defaultOrganizationId)
  }

  if (await runtime.isDatabaseEmpty(user.id)) {
    await runtime.createUserDefaults(user.id)
  }
  
  return refreshedUser
}

export const getUserById = cache(async (id: string, dependencies: UserRuntimeDependencies = {}) => {
  const runtime = await resolveRuntimeDependencies(dependencies)
  const user = await runtime.prisma.user.findUnique({
    where: { id },
  })

  if (!user) {
    return null
  }

  await runtime.ensureOrganizationBootstrapForUser(user.id)

  const refreshedUser = (await runtime.prisma.user.findUnique({
    where: { id: user.id },
  })) ?? user

  if (refreshedUser.defaultOrganizationId) {
    await runtime.ensureOrganizationBillingBootstrapForUser(refreshedUser, refreshedUser.defaultOrganizationId)
  }

  return refreshedUser
})

export const getUserByEmail = cache(async (email: string) => {
  const runtime = await resolveRuntimeDependencies()

  return await runtime.prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  })
})

export function updateUser(userId: string, data: Prisma.UserUpdateInput) {
  return resolveRuntimeDependencies().then((runtime) =>
    runtime.prisma.user.update({
      where: { id: userId },
      data,
    })
  )
}

async function resolveRuntimeDependencies(dependencies: UserRuntimeDependencies = {}) {
  const [dbModule, defaultsModule, organizationsModule, platformAdminsModule, billingBootstrapModule] = await Promise.all([
    dependencies.prisma ? null : import("../lib/db.ts"),
    dependencies.isDatabaseEmpty && dependencies.createUserDefaults ? null : import("./defaults.ts"),
    dependencies.ensureOrganizationBootstrapForUser ? null : import("./organizations.ts"),
    dependencies.ensureSelfHostedPlatformOwner ? null : import("./platform-admins.ts"),
    dependencies.ensureOrganizationBillingBootstrapForUser ? null : import("./billing/bootstrap.ts"),
  ])

  return {
    prisma: dependencies.prisma ?? ((dbModule?.prisma as unknown) as UserBootstrapStore),
    isDatabaseEmpty: dependencies.isDatabaseEmpty ?? defaultsModule!.isDatabaseEmpty,
    createUserDefaults: dependencies.createUserDefaults ?? defaultsModule!.createUserDefaults,
    ensureOrganizationBootstrapForUser:
      dependencies.ensureOrganizationBootstrapForUser ?? organizationsModule!.ensureOrganizationBootstrapForUser,
    ensureOrganizationBillingBootstrapForUser:
      dependencies.ensureOrganizationBillingBootstrapForUser ??
      billingBootstrapModule!.ensureOrganizationBillingBootstrapForUser,
    ensureSelfHostedPlatformOwner:
      dependencies.ensureSelfHostedPlatformOwner ?? platformAdminsModule!.ensureSelfHostedPlatformOwner,
  }
}
