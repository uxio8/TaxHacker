import { NextResponse } from "next/server.js"

import { getCurrentOrganizationUserBillingProjection } from "../../../../models/billing/access.ts"
import { buildOrganizationActionUser } from "../../../../models/billing/runtime.ts"
import { getMobileInbox as getMobileInboxModel } from "../../../../models/mobile/inbox.ts"

type MobileInboxRouteUser = {
  id: string
  organizationId: string
  email: string
  storageLimit: number
  storageUsed: number
  membershipExpiresAt: Date | null
  accessStatus?: string | null
}

type MobileInboxRouteDependencies = {
  getSession?: () => Promise<{ user?: { id?: string } } | null>
  getUserById?: (userId: string) => Promise<MobileInboxRouteUser | null>
  getMobileInbox?: (
    user: MobileInboxRouteUser
  ) => Promise<Awaited<ReturnType<typeof getMobileInboxModel>>>
}

function createDefaultDependencies(): Required<MobileInboxRouteDependencies> {
  return {
    getSession: async () => {
      const { getSession } = await import("../../../../lib/auth.ts")
      return getSession()
    },
    getUserById: async (userId) => {
      const { getUserById } = await import("../../../../models/users.ts")
      const fullUser = await getUserById(userId)
      if (!fullUser) {
        return null
      }

      const organizationId = fullUser.defaultOrganizationId ?? fullUser.id
      const billingProjection = await getCurrentOrganizationUserBillingProjection(organizationId)

      return buildOrganizationActionUser(
        {
          id: fullUser.id,
          email: fullUser.email,
        },
        {
          organizationId,
          storageLimit: billingProjection.storageLimit,
          storageUsed: billingProjection.storageUsed,
          membershipExpiresAt: billingProjection.membershipExpiresAt,
          accessStatus: billingProjection.accessStatus,
        }
      )
    },
    getMobileInbox: getMobileInboxModel,
  }
}

export function createMobileInboxRoute(dependencies: MobileInboxRouteDependencies = {}) {
  const deps = {
    ...createDefaultDependencies(),
    ...dependencies,
  }

  return async function GET() {
    const session = await deps.getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
      const user = await deps.getUserById(session.user.id)
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      const response = await deps.getMobileInbox(user)

      return NextResponse.json(response, { status: 200 })
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Internal server error",
        },
        { status: 500 }
      )
    }
  }
}
