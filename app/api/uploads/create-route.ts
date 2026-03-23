import { NextResponse } from "next/server.js"

import { getCurrentOrganizationUserBillingProjection } from "../../../models/billing/access.ts"
import { buildOrganizationActionUser } from "../../../models/billing/runtime.ts"
import { UPLOAD_DESTINATION, uploadFiles as uploadFilesModel, type UploadFilesResult } from "../../../models/uploads.ts"

type UploadsRouteUser = {
  id: string
  organizationId: string
  email: string
  storageLimit: number
  storageUsed: number
  membershipExpiresAt: Date | null
  accessStatus?: string | null
}

type UploadsRouteDependencies = {
  getSession?: () => Promise<{ user?: { id?: string } } | null>
  getUserById?: (userId: string) => Promise<UploadsRouteUser | null>
  requireCurrentTenantWriteAccess?: (input: {
    getCurrentUser: () => Promise<{
      id: string
      defaultOrganizationId: string | null
    }>
  }) => Promise<unknown>
  uploadFiles?: typeof uploadFilesModel
  revalidatePath?: (pathname: string) => Promise<void> | void
}

function createDefaultDependencies(): Required<UploadsRouteDependencies> {
  return {
    getSession: async () => {
      const { getSession } = await import("../../../lib/auth.ts")
      return getSession()
    },
    getUserById: async (userId) => {
      const { getUserById } = await import("../../../models/users.ts")
      const user = await getUserById(userId)
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
      const { requireCurrentTenantWriteAccess } = await import("../../../lib/tenant.ts")
      return requireCurrentTenantWriteAccess(input)
    },
    uploadFiles: uploadFilesModel,
    revalidatePath: async (pathname) => {
      const { revalidatePath } = await import("next/cache")
      revalidatePath(pathname)
    },
  }
}

function extractFiles(formData: FormData) {
  return [...formData.getAll("files[]"), ...formData.getAll("files")].filter((value): value is File => value instanceof File)
}

function trimTransactionId(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function toResponseBody(result: UploadFilesResult) {
  if (!result.success) {
    return {
      success: false,
      error: result.error,
    }
  }

  return {
    success: true,
    error: null,
    destination: result.destination,
    transactionId: result.transactionId,
    files: result.files,
  }
}

export function createUploadsRoute(dependencies: UploadsRouteDependencies = {}) {
  const deps = {
    ...createDefaultDependencies(),
    ...dependencies,
  }

  return async function POST(request: Request) {
    const session = await deps.getSession()
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 }
      )
    }

    const user = await deps.getUserById(session.user.id)
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 }
      )
    }

    try {
      await deps.requireCurrentTenantWriteAccess({
        getCurrentUser: async () => ({
          id: user.id,
          defaultOrganizationId: user.organizationId,
        }),
      })
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Forbidden",
        },
        { status: 403 }
      )
    }

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid multipart/form-data",
        },
        { status: 400 }
      )
    }

    try {
      const result = await deps.uploadFiles({
        user,
        files: extractFiles(formData),
        transactionId: trimTransactionId(formData.get("transactionId")),
      })

      if (result.success) {
        if (result.destination === UPLOAD_DESTINATION.UNSORTED) {
          await deps.revalidatePath("/unsorted")
        }

        if (result.destination === UPLOAD_DESTINATION.TRANSACTION && result.transactionId) {
          await deps.revalidatePath(`/transactions/${result.transactionId}`)
        }
      }

      return NextResponse.json(toResponseBody(result), { status: result.status })
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Internal server error",
        },
        { status: 500 }
      )
    }
  }
}
