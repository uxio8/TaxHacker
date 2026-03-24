import { NextResponse } from "next/server.js"

import { getCurrentOrganizationUserBillingProjection } from "../../../../models/billing/access.ts"
import { buildOrganizationActionUser } from "../../../../models/billing/runtime.ts"
import { captureMobileFiles } from "../../../../models/mobile/capture.ts"

type MobileCaptureRouteDependencies = {
  getCurrentUser?: () => Promise<Record<string, unknown> | null>
  requireCurrentTenantWriteAccess?: (input: {
    getCurrentUser: () => Promise<{
      id: string
      defaultOrganizationId: string | null
    }>
  }) => Promise<unknown>
  captureMobileFiles?: typeof captureMobileFiles
}

function createDefaultDependencies(): Required<MobileCaptureRouteDependencies> {
  return {
    getCurrentUser: async () => {
      const [{ getSession }, { getUserById }] = await Promise.all([
        import("../../../../lib/auth.ts"),
        import("../../../../models/users.ts"),
      ])

      const session = await getSession()
      if (!session?.user?.id) {
        return null
      }

      const user = await getUserById(session.user.id)
      if (!user) {
        return null
      }

      const organizationId = user.defaultOrganizationId ?? user.id
      const billingProjection = await getCurrentOrganizationUserBillingProjection(organizationId)

      return buildOrganizationActionUser(
        {
          id: user.id,
          email: user.email,
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
    requireCurrentTenantWriteAccess: async (input) => {
      const { requireCurrentTenantWriteAccess } = await import("../../../../lib/tenant.ts")
      return requireCurrentTenantWriteAccess(input)
    },
    captureMobileFiles,
  }
}

function extractFiles(formData: FormData) {
  return [...formData.getAll("files[]"), ...formData.getAll("files")].filter((value): value is File => value instanceof File)
}

export function createMobileCaptureRoute(dependencies: MobileCaptureRouteDependencies = {}) {
  const deps = {
    ...createDefaultDependencies(),
    ...dependencies,
  }

  return async function POST(request: Request) {
    const user = await deps.getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
      await deps.requireCurrentTenantWriteAccess({
        getCurrentUser: async () => ({
          id: user.id as string,
          defaultOrganizationId:
            typeof user.organizationId === "string"
              ? user.organizationId
              : typeof user.defaultOrganizationId === "string"
                ? user.defaultOrganizationId
                : null,
        }),
      })
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Forbidden",
        },
        { status: 403 }
      )
    }

    try {
      const formData = await request.formData()
      const result = await deps.captureMobileFiles({
        user: user as never,
        files: extractFiles(formData),
      })

      if (!result.ok) {
        return NextResponse.json(
          {
            error: result.error,
            reasonCode: result.reasonCode,
          },
          { status: result.status }
        )
      }

      return NextResponse.json(
        {
          items: result.items.map((item) => ({
            fileId: item.fileId,
            state: item.state,
            reasonCode: item.reasonCode,
            confidence: item.confidence,
            inboxUrl: item.inboxUrl,
            reviewUrl: item.reviewUrl,
          })),
        },
        { status: 201 }
      )
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
