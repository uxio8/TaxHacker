"use server"

import { parseCounterpartyFormData } from "@/forms/fiscal/counterparties"
import { ActionState } from "@/lib/actions"
import { getCurrentUser } from "@/lib/auth"
import { createTranslator } from "@/lib/i18n"
import { requireCurrentWritableOrganizationId } from "@/lib/tenant"
import {
  getCounterpartyById,
  normalizeCounterpartyTaxId,
  upsertCounterparty,
} from "@/models/fiscal/counterparties"
import { getFiscalProfileAccessByOrganizationId } from "@/models/fiscal/profile"
import { isFiscalStorageNotReadyError } from "@/models/fiscal/storage"
import type { Counterparty } from "@/prisma/client"
import { revalidatePath } from "next/cache"

const t = createTranslator()

function getCounterpartyEditConstraintError(counterparty: Counterparty, displayName: string, taxId: string | null) {
  const currentTaxId = normalizeCounterpartyTaxId(counterparty.taxId)
  const nextTaxId = normalizeCounterpartyTaxId(taxId)

  if (currentTaxId && currentTaxId !== nextTaxId) {
    return t("tax.counterparties.form.errors.taxIdLocked")
  }

  if (!currentTaxId && displayName !== counterparty.displayName) {
    return t("tax.counterparties.form.errors.nameLockedWithoutTaxId")
  }

  return null
}

export async function saveCounterpartyAction(
  _prevState: ActionState<Counterparty> | null,
  formData: FormData
): Promise<ActionState<Counterparty>> {
  const user = await getCurrentUser()
  const organizationId = await requireCurrentWritableOrganizationId({
    getCurrentUser: async () => user,
  })
  const fiscalProfileAccess = await getFiscalProfileAccessByOrganizationId(organizationId, user.id)

  if (fiscalProfileAccess.status === "storage_not_ready") {
    return { success: false, error: t("tax.storageNotReady.actionError") }
  }

  if (fiscalProfileAccess.status !== "ready") {
    return { success: false, error: t("tax.counterparties.setup.description") }
  }

  const validatedForm = parseCounterpartyFormData(formData)

  if (!validatedForm.success) {
    return { success: false, error: validatedForm.error.issues[0]?.message ?? validatedForm.error.message }
  }

  const { counterpartyId, displayName, taxId, countryCode, isActive } = validatedForm.data

  if (counterpartyId) {
    const existingCounterparty = await getCounterpartyById(counterpartyId, fiscalProfileAccess.profile.id)

    if (!existingCounterparty) {
      return { success: false, error: t("tax.counterparties.form.errors.notFound") }
    }

    const editConstraintError = getCounterpartyEditConstraintError(existingCounterparty, displayName, taxId)

    if (editConstraintError) {
      return { success: false, error: editConstraintError }
    }
  }

  try {
    const counterparty = await upsertCounterparty(fiscalProfileAccess.profile.id, {
      displayName,
      taxId,
      countryCode,
      isActive,
    })

    revalidatePath("/tax/counterparties")
    return { success: true, data: counterparty }
  } catch (error) {
    return {
      success: false,
      error: isFiscalStorageNotReadyError(error)
        ? t("tax.storageNotReady.actionError")
        : error instanceof Error
          ? error.message
          : t("common.errors.generic"),
    }
  }
}
