"use server"

import { randomUUID } from "node:crypto"

import { ActionState } from "@/lib/actions"
import { getCurrentUser } from "@/lib/auth"
import { requireCurrentWritableOrganizationId } from "@/lib/tenant"
import { buildOrganizationStaticObjectKey } from "@/lib/storage/keys"
import { getCurrentOrganizationUserBillingProjection } from "@/models/billing/access"
import { buildOrganizationActionUser } from "@/models/billing/runtime"
import {
  getFiscalFilingDossierByObligationId,
  upsertFiscalFilingDossier,
} from "@/models/fiscal/filing-dossiers"
import {
  getFiscalObligationByCodeAndPeriod,
  syncFiscalObligationsForOrganization,
  updateFiscalObligationFilingState,
  type FiscalObligationCode,
} from "@/models/fiscal/obligations"
import { uploadFiles } from "@/models/uploads"
import { revalidatePath } from "next/cache"

type FilingDossierActionState = ActionState<{
  status: "draft_ready" | "ready_to_file" | "filed"
  filingReference: string | null
  filingReceiptFileId: string | null
}>

function readString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function trimToNull(value: string) {
  return value ? value : null
}

function isObligationCode(value: string): value is FiscalObligationCode {
  return value === "303" || value === "115" || value === "180" || value === "390"
}

function isAllowedStatus(value: string): value is "draft_ready" | "ready_to_file" | "filed" {
  return value === "draft_ready" || value === "ready_to_file" || value === "filed"
}

function parseDraftSnapshot(value: string) {
  if (!value) {
    return {}
  }

  try {
    const parsed = JSON.parse(value)
    return typeof parsed === "object" && parsed !== null ? parsed : {}
  } catch {
    throw new Error("El snapshot del borrador no tiene un formato válido")
  }
}

function buildChecklistState(status: "draft_ready" | "ready_to_file" | "filed") {
  return {
    draftReady: true,
    readyToFile: status === "ready_to_file" || status === "filed",
    filed: status === "filed",
  }
}

async function uploadReceiptIfNeeded(input: {
  receiptFile: File | null
  organizationId: string
  obligationId: string
  user: {
    id: string
    email: string
  }
}) {
  if (!input.receiptFile || input.receiptFile.size <= 0) {
    return null
  }

  const billingProjection = await getCurrentOrganizationUserBillingProjection(input.organizationId)
  const result = await uploadFiles(
    {
      user: buildOrganizationActionUser(input.user, {
        organizationId: input.organizationId,
        storageLimit: billingProjection.storageLimit,
        storageUsed: billingProjection.storageUsed,
        membershipExpiresAt: billingProjection.membershipExpiresAt,
        accessStatus: billingProjection.accessStatus,
      }),
      files: [input.receiptFile],
    },
    {
      createId: () => randomUUID(),
      buildUnsortedTarget: async (organizationId, fileId, file) => ({
        destination: "unsorted",
        storedFilename: file.name,
        relativePath: buildOrganizationStaticObjectKey(
          organizationId,
          "fiscal-filings",
          input.obligationId || fileId,
          file.name
        ),
        isReviewed: true,
      }),
    }
  )

  if (!result.success) {
    throw new Error(result.error)
  }

  return result.files[0]?.id ?? null
}

function revalidateFilingPaths(obligationCode: FiscalObligationCode, periodKey: string) {
  const encodedPeriodKey = encodeURIComponent(periodKey)
  const paths = [
    "/tax",
    "/tax/forms",
    `/tax/forms/${obligationCode}`,
    "/tax/archive",
    `/tax/archive/${encodedPeriodKey}`,
    "/tax/quarters",
    `/tax/quarters/${encodedPeriodKey}`,
  ]

  for (const path of paths) {
    revalidatePath(path)
  }
}

export async function saveFiscalFilingDossierAction(
  _prevState: FilingDossierActionState | null,
  formData: FormData
): Promise<FilingDossierActionState> {
  const obligationCodeValue = readString(formData, "obligationCode")
  const periodKey = readString(formData, "periodKey")
  const statusValue = readString(formData, "status")
  const filingReference = readString(formData, "filingReference")
  const filingNotes = readString(formData, "filingNotes")
  const draftSnapshotRaw = readString(formData, "draftSnapshot")
  const receiptValue = formData.get("receipt")
  const receiptFile = receiptValue instanceof File && receiptValue.size > 0 ? receiptValue : null

  if (!isObligationCode(obligationCodeValue)) {
    return { success: false, error: "Obligación fiscal no soportada todavía." }
  }

  if (!periodKey) {
    return { success: false, error: "El periodo fiscal es obligatorio." }
  }

  if (!isAllowedStatus(statusValue)) {
    return { success: false, error: "Selecciona un estado válido del expediente." }
  }

  if (statusValue === "filed" && !filingReference) {
    return { success: false, error: "Hace falta la referencia externa o CSV para marcarla como presentada." }
  }

  try {
    const user = await getCurrentUser()
    const organizationId = await requireCurrentWritableOrganizationId({
      getCurrentUser: async () => user,
    })

    await syncFiscalObligationsForOrganization(organizationId)

    const obligation = await getFiscalObligationByCodeAndPeriod(
      organizationId,
      obligationCodeValue,
      periodKey
    )

    if (!obligation) {
      return { success: false, error: "No existe todavía una obligación fiscal operativa para ese periodo." }
    }

    const currentDossier = await getFiscalFilingDossierByObligationId(obligation.id)
    const uploadedReceiptFileId = await uploadReceiptIfNeeded({
      receiptFile,
      organizationId,
      obligationId: obligation.id,
      user: {
        id: user.id,
        email: user.email,
      },
    })
    const filingReceiptFileId = uploadedReceiptFileId ?? currentDossier?.filingReceiptFileId ?? null
    const checklistState = buildChecklistState(statusValue)
    const filingReferenceValue = trimToNull(filingReference)
    const filingNotesValue = trimToNull(filingNotes)
    const filedAt = statusValue === "filed" ? new Date() : null
    const filedByUserId = statusValue === "filed" ? user.id : null

    await updateFiscalObligationFilingState({
      organizationId,
      code: obligationCodeValue,
      periodKey,
      status: statusValue,
      filingReference: filingReferenceValue,
      filedAt,
      filedByUserId,
      notes: filingNotesValue,
    })

    await upsertFiscalFilingDossier({
      fiscalObligationId: obligation.id,
      draftSnapshot: parseDraftSnapshot(draftSnapshotRaw),
      evidenceManifest: {
        required: obligation.requiredEvidence,
        attached: filingReceiptFileId ? [filingReceiptFileId] : [],
        externalReference: filingReferenceValue,
      },
      checklistState,
      filingReference: filingReferenceValue,
      filedAt,
      filedByUserId,
      filingReceiptFileId,
      filingNotes: filingNotesValue,
    })

    revalidateFilingPaths(obligationCodeValue, periodKey)

    return {
      success: true,
      data: {
        status: statusValue,
        filingReference: filingReferenceValue,
        filingReceiptFileId,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "No se ha podido guardar el expediente fiscal.",
    }
  }
}
