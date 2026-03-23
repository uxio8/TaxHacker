"use server"

import { ActionState } from "@/lib/actions"
import { getCurrentUser } from "@/lib/auth"
import { requireCurrentWritableOrganizationId } from "@/lib/tenant"
import { getCurrentOrganizationUserBillingProjection } from "@/models/billing/access"
import { buildOrganizationActionUser } from "@/models/billing/runtime"
import { uploadFiles } from "@/models/uploads"
import { revalidatePath } from "next/cache"

export async function uploadFilesAction(formData: FormData): Promise<ActionState<null>> {
  const user = await getCurrentUser()
  const organizationId = await requireCurrentWritableOrganizationId({
    getCurrentUser: async () => user,
  })
  const billingProjection = await getCurrentOrganizationUserBillingProjection(organizationId)
  const result = await uploadFiles({
    user: buildOrganizationActionUser(
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
    ),
    files: formData.getAll("files").filter((value): value is File => value instanceof File),
  })

  if (!result.success) {
    return { success: false, error: result.error }
  }

  revalidatePath("/unsorted")
  return { success: true, error: null }
}
