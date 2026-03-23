"use server"

import { revalidatePath } from "next/cache"

import type { ActionState } from "@/lib/actions"
import { getCurrentUser } from "@/lib/auth"
import { requireCurrentWritableOrganizationId } from "@/lib/tenant"
import {
  getFiscalObligationByCodeAndPeriod,
  syncFiscalObligationsForOrganization,
  updateFiscalObligationOperationalState,
  type FiscalObligationOwner,
  type FiscalObligationStatus,
} from "@/models/fiscal/obligations"
import type { AnnualHandoffItemCode } from "@/models/fiscal/annual-handoff"

type AnnualHandoffActionState = ActionState<{
  code: AnnualHandoffItemCode
  status: FiscalObligationStatus
  owner: FiscalObligationOwner
  notes: string | null
}>

function readString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function isAnnualHandoffItemCode(value: string): value is AnnualHandoffItemCode {
  return (
    value === "202_handoff"
    || value === "book_legalization"
    || value === "annual_accounts"
    || value === "200_handoff"
    || value === "mercantile_filing"
  )
}

function isAnnualHandoffStatus(value: string): value is FiscalObligationStatus {
  return (
    value === "not_applicable"
    || value === "waiting_on_documents"
    || value === "needs_review"
    || value === "draft_ready"
    || value === "ready_to_file"
    || value === "filed"
    || value === "archived"
  )
}

function isAnnualOwner(value: string): value is FiscalObligationOwner {
  return value === "advisor" || value === "client" || value === "shared"
}

function trimToNull(value: string) {
  return value ? value : null
}

function revalidateAnnualPaths() {
  revalidatePath("/tax")
  revalidatePath("/tax/archive")
  revalidatePath("/tax/archive/annual")
}

export async function saveAnnualHandoffItemAction(
  _prevState: AnnualHandoffActionState | null,
  formData: FormData
): Promise<AnnualHandoffActionState> {
  const codeValue = readString(formData, "code")
  const periodKey = readString(formData, "periodKey")
  const statusValue = readString(formData, "status")
  const ownerValue = readString(formData, "owner")
  const notesValue = readString(formData, "notes")

  if (!isAnnualHandoffItemCode(codeValue)) {
    return { success: false, error: "Ítem anual no soportado." }
  }

  if (!periodKey) {
    return { success: false, error: "Falta el ejercicio del handoff anual." }
  }

  if (!isAnnualHandoffStatus(statusValue)) {
    return { success: false, error: "Selecciona un estado anual válido." }
  }

  if (!isAnnualOwner(ownerValue)) {
    return { success: false, error: "Selecciona un responsable válido." }
  }

  try {
    const user = await getCurrentUser()
    const organizationId = await requireCurrentWritableOrganizationId({
      getCurrentUser: async () => user,
    })

    await syncFiscalObligationsForOrganization(organizationId)

    const obligation = await getFiscalObligationByCodeAndPeriod(organizationId, codeValue, periodKey)

    if (!obligation) {
      return { success: false, error: "No existe todavía el ítem anual para ese ejercicio." }
    }

    const filedAt = statusValue === "filed" ? new Date() : null
    const filedByUserId = statusValue === "filed" ? user.id : null

    await updateFiscalObligationOperationalState({
      organizationId,
      code: codeValue,
      periodKey,
      status: statusValue,
      owner: ownerValue,
      filedAt,
      filedByUserId,
      notes: trimToNull(notesValue),
    })

    revalidateAnnualPaths()

    return {
      success: true,
      data: {
        code: codeValue,
        status: statusValue,
        owner: ownerValue,
        notes: trimToNull(notesValue),
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "No se ha podido guardar el seguimiento anual.",
    }
  }
}
