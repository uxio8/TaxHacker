"use server"

import { ActionState } from "@/lib/actions"
import { getCurrentUser } from "@/lib/auth"
import { requireCurrentWritableOrganizationId } from "@/lib/tenant"
import { getFiscalProfileAccessByOrganizationId } from "@/models/fiscal/profile"
import {
  createFiscalReviewRequest,
  resolveFiscalReviewRequest,
} from "@/models/fiscal/review-requests"
import { revalidatePath } from "next/cache"

function readString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function isOwner(value: string): value is "client" | "advisor" | "shared" {
  return value === "client" || value === "advisor" || value === "shared"
}

function revalidateReviewRequestPaths() {
  const paths = ["/tax", "/tax/review", "/unsorted", "/capture/inbox"]

  for (const path of paths) {
    revalidatePath(path)
  }
}

export async function createFiscalReviewRequestAction(
  _prevState: ActionState<{ fiscalDocumentId: string }> | null,
  formData: FormData
): Promise<ActionState<{ fiscalDocumentId: string }>> {
  const fiscalDocumentId = readString(formData, "fiscalDocumentId")
  const owner = readString(formData, "owner")
  const message = readString(formData, "message")
  const dueDate = readString(formData, "dueDate")

  if (!fiscalDocumentId || !message) {
    return { success: false, error: "Hace falta indicar documento fiscal y mensaje." }
  }

  if (!isOwner(owner)) {
    return { success: false, error: "Selecciona un responsable válido." }
  }

  const user = await getCurrentUser()
  const organizationId = await requireCurrentWritableOrganizationId({
    getCurrentUser: async () => user,
  })
  const fiscalProfileAccess = await getFiscalProfileAccessByOrganizationId(organizationId, user.id)

  if (fiscalProfileAccess.status !== "ready") {
    return { success: false, error: "Hace falta un perfil fiscal listo para abrir incidencias." }
  }

  await createFiscalReviewRequest({
    organizationId,
    ownerScopeId: fiscalProfileAccess.profile.id,
    fiscalDocumentId,
    createdByUserId: user.id,
    actorType: "advisor",
    owner,
    message,
    dueDate: dueDate || null,
  })

  revalidateReviewRequestPaths()

  return {
    success: true,
    data: {
      fiscalDocumentId,
    },
  }
}

export async function resolveFiscalReviewRequestAction(formData: FormData) {
  const requestId = readString(formData, "requestId")

  if (!requestId) {
    return
  }

  const user = await getCurrentUser()
  await requireCurrentWritableOrganizationId({
    getCurrentUser: async () => user,
  })

  await resolveFiscalReviewRequest({
    requestId,
    resolvedByUserId: user.id,
  })

  revalidateReviewRequestPaths()
}
