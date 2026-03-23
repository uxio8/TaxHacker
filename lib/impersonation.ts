import {
  PLATFORM_IMPERSONATION_COOKIE_NAME,
  buildPlatformImpersonationCookieValue,
  readPlatformImpersonationCookieSessionId,
} from "./security.ts"

type ImpersonationSessionRecord = {
  id: string
  userId: string
  organizationId: string
  assumedUserId?: string | null
  mode: "read_only" | "read_write"
  reason: string
  expiresAt: Date
  revokedAt: Date | null
}

type ImpersonationUserRecord = {
  id: string
  email: string
  name: string | null
  defaultOrganizationId: string | null
}

type ResolvePlatformImpersonationDependencies = {
  authSecret: string
  getActiveSupportAccessSessionByIdForUser: (input: {
    sessionId: string
    userId: string
  }) => Promise<ImpersonationSessionRecord | null>
  getUserById: (userId: string) => Promise<ImpersonationUserRecord | null>
}

export type ResolvedPlatformImpersonation = {
  session: ImpersonationSessionRecord & {
    assumedUserId: string
  }
  effectiveUser: ImpersonationUserRecord
}

export { PLATFORM_IMPERSONATION_COOKIE_NAME, buildPlatformImpersonationCookieValue }

export async function resolvePlatformImpersonation(
  input: {
    actorUserId: string
    cookieValue: string | null | undefined
  },
  dependencies: ResolvePlatformImpersonationDependencies
): Promise<ResolvedPlatformImpersonation | null> {
  const sessionId = await readPlatformImpersonationCookieSessionId(
    input.cookieValue,
    input.actorUserId,
    dependencies.authSecret
  )

  if (!sessionId) {
    return null
  }

  const session = await dependencies.getActiveSupportAccessSessionByIdForUser({
    sessionId,
    userId: input.actorUserId,
  })

  if (!session?.assumedUserId) {
    return null
  }

  const assumedUser = await dependencies.getUserById(session.assumedUserId)

  if (!assumedUser) {
    return null
  }

  return {
    session: {
      ...session,
      assumedUserId: session.assumedUserId,
    },
    effectiveUser: {
      ...assumedUser,
      defaultOrganizationId: session.organizationId,
    },
  }
}
