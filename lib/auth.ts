import config from "@/lib/config"
import { PLATFORM_IMPERSONATION_COOKIE_NAME, resolvePlatformImpersonation } from "@/lib/impersonation"
import { getSelfHostedUser, getUserByEmail, getUserById } from "@/models/users"
import { getActiveSupportAccessSessionByIdForUser } from "@/models/support-access"
import { isOrganizationAccessRestricted, type SidebarUserProfile } from "@/models/billing/runtime"
import { User } from "@/prisma/client"
import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { APIError } from "better-auth/api"
import { nextCookies } from "better-auth/next-js"
import { emailOTP } from "better-auth/plugins/email-otp"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { prisma } from "./db"
import { resend, sendOTPCodeEmail } from "./email"
import { hasSelfHostedAccess } from "./security"

export type UserProfile = SidebarUserProfile

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  appName: config.app.title,
  baseURL: config.app.baseURL,
  secret: config.auth.secret,
  ...(resend
    ? {
        email: {
          provider: "resend" as const,
          from: config.email.from,
          resend,
        },
      }
    : {}),
  session: {
    strategy: "jwt",
    expiresIn: 180 * 24 * 60 * 60, // 365 days
    updateAge: 24 * 60 * 60, // 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 365 * 24 * 60 * 60, // 365 days
    },
  },
  advanced: {
    cookiePrefix: "taxhacker",
    database: {
      generateId: "uuid",
    },
  },
  plugins: [
    emailOTP({
      disableSignUp: config.auth.disableSignup,
      otpLength: 6,
      expiresIn: 10 * 60, // 10 minutes
      sendVerificationOTP: async ({ email, otp }) => {
        const user = await getUserByEmail(email)
        if (!user) {
          throw new APIError("NOT_FOUND", { message: "User with this email does not exist" })
        }
        await sendOTPCodeEmail({ email, otp })
      },
    }),
    nextCookies(), // make sure this is the last plugin in the array
  ],
})

async function hasValidatedSelfHostedAccess() {
  if (!config.selfHosted.isEnabled || !config.selfHosted.adminToken) {
    return false
  }

  const cookieStore = await cookies()

  return await hasSelfHostedAccess(
    cookieStore.get(config.selfHosted.accessCookieName)?.value,
    config.selfHosted.adminToken,
    config.auth.secret
  )
}

async function getAuthenticatedSession() {
  if (config.selfHosted.isEnabled) {
    if (!(await hasValidatedSelfHostedAccess())) {
      return null
    }

    const user = await getSelfHostedUser()
    return user ? { user } : null
  }

  return await auth.api.getSession({
    headers: await headers(),
  })
}

export type CurrentImpersonation = {
  actorUser: User
  effectiveUser: User
  session: {
    id: string
    organizationId: string
    assumedUserId: string
    mode: "read_only" | "read_write"
    reason: string
    expiresAt: Date
  }
}

async function resolveCurrentAuthContext() {
  const session = await getAuthenticatedSession()

  if (!session?.user?.id) {
    return null
  }

  const actorUser = await getUserById(session.user.id)

  if (!actorUser) {
    return null
  }

  const cookieStore = await cookies()
  const impersonation = await resolvePlatformImpersonation(
    {
      actorUserId: actorUser.id,
      cookieValue: cookieStore.get(PLATFORM_IMPERSONATION_COOKIE_NAME)?.value,
    },
    {
      authSecret: config.auth.secret,
      getActiveSupportAccessSessionByIdForUser,
      getUserById,
    }
  )

  if (!impersonation) {
    return {
      actorUser,
      effectiveUser: actorUser,
      impersonation: null,
    }
  }

  return {
    actorUser,
    effectiveUser: impersonation.effectiveUser as User,
    impersonation: {
      actorUser,
      effectiveUser: impersonation.effectiveUser as User,
      session: {
        id: impersonation.session.id,
        organizationId: impersonation.session.organizationId,
        assumedUserId: impersonation.session.assumedUserId,
        mode: impersonation.session.mode,
        reason: impersonation.session.reason,
        expiresAt: impersonation.session.expiresAt,
      },
    } satisfies CurrentImpersonation,
  }
}

export async function getSession() {
  const authContext = await resolveCurrentAuthContext()

  if (!authContext) {
    return null
  }

  return {
    user: authContext.effectiveUser,
  }
}

export async function getCurrentActorUser(): Promise<User> {
  const authContext = await resolveCurrentAuthContext()

  if (authContext?.actorUser) {
    return authContext.actorUser
  }

  if (config.selfHosted.isEnabled) {
    redirect(config.selfHosted.welcomeUrl)
  }

  redirect(config.auth.loginUrl)
}

export async function getCurrentImpersonation() {
  const authContext = await resolveCurrentAuthContext()
  return authContext?.impersonation ?? null
}

export async function getCurrentUser(): Promise<User> {
  const authContext = await resolveCurrentAuthContext()

  if (authContext?.effectiveUser) {
    return authContext.effectiveUser
  }

  if (config.selfHosted.isEnabled) {
    redirect(config.selfHosted.welcomeUrl)
  }

  redirect(config.auth.loginUrl)
}

type SubscriptionAccessSubject = {
  membershipExpiresAt?: Date | null
  accessStatus?: string | null
}

export function isSubscriptionExpired(
  user: SubscriptionAccessSubject
) {
  if (config.selfHosted.isEnabled) {
    return false
  }
  if ("accessStatus" in user && isOrganizationAccessRestricted(user.accessStatus as never)) {
    return true
  }
  return user.membershipExpiresAt && user.membershipExpiresAt < new Date()
}

type AiAccessSubject = {
  membershipPlan?: string | null
  aiBalance?: number | null
  accessStatus?: string | null
}

export function isAiBalanceExhausted(
  user: AiAccessSubject
) {
  if (
    config.selfHosted.isEnabled
    || user.membershipPlan === "unlimited"
    || ("accessStatus" in user && isOrganizationAccessRestricted(user.accessStatus as never))
  ) {
    return false
  }
  return (user.aiBalance ?? 0) <= 0
}
