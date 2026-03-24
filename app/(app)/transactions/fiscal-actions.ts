"use server"

import {
  buildTransactionFiscalPanelAuditReason,
  buildTransactionFiscalPanelDocumentInput,
  collectAffectedPeriodKeys,
  getCounterpartyResolutionAuditEvent,
  parseTransactionFiscalPanelIntent,
} from "./fiscal-panel-shared.ts"
import {
  appendFiscalAuditEvent,
} from "../../../models/fiscal/audit-log.ts"
import { getCounterpartyById, upsertCounterparty } from "../../../models/fiscal/counterparties.ts"
import {
  getTransactionFiscalBySourceTransactionId,
  type TransactionFiscalDocument,
  upsertTransactionFiscal,
} from "../../../models/fiscal/transaction-fiscal.ts"
import type { ActionState } from "../../../lib/actions.ts"
import { requireCurrentWritableOrganizationId } from "../../../lib/tenant.ts"
import { getFiscalProfileAccessByOrganizationId } from "../../../models/fiscal/profile.ts"

function trimToNull(value?: string | null): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function normalizeDateOnly(value?: string | null): string | null {
  const normalized = trimToNull(value)
  return normalized ? normalized.slice(0, 10) : null
}

export async function saveTransactionFiscalPanelAction(
  _prevState: ActionState<TransactionFiscalDocument> | null,
  formData: FormData
): Promise<ActionState<TransactionFiscalDocument>> {
  try {
    const { getCurrentUser } = await import("../../../lib/auth.ts")
    const { revalidatePath } = await import("next/cache")

    const sourceTransactionId = trimToNull(formData.get("sourceTransactionId")?.toString())

    if (!sourceTransactionId) {
      return { success: false, error: "Falta la transacción origen del panel fiscal" }
    }

    const intent = parseTransactionFiscalPanelIntent(formData.get("intent"))
    const paymentDate = normalizeDateOnly(formData.get("paymentDate")?.toString())
    const periodKey = trimToNull(formData.get("periodKey")?.toString())
    const requestedCounterpartyId = trimToNull(formData.get("counterpartyId")?.toString())
    const counterpartyDisplayName = trimToNull(formData.get("counterpartyDisplayName")?.toString())
    const counterpartyTaxId = trimToNull(formData.get("counterpartyTaxId")?.toString())
    const counterpartyResolutionNote = trimToNull(
      formData.get("counterpartyResolutionNote")?.toString()
    )
    const assignedAt = new Date()
    const user = await getCurrentUser()
    const organizationId = await requireCurrentWritableOrganizationId({
      getCurrentUser: async () => user,
    })
    const fiscalProfileAccess = await getFiscalProfileAccessByOrganizationId(
      organizationId,
      user.id
    )

    if (fiscalProfileAccess.status !== "ready") {
      return {
        success: false,
        error: "El perfil fiscal no está disponible para editar esta transacción",
      }
    }

    const document = await getTransactionFiscalBySourceTransactionId(
      sourceTransactionId,
      fiscalProfileAccess.profile.id
    )

    if (!document) {
      return {
        success: false,
        error: "Esta transacción todavía no tiene un documento fiscal asociado",
      }
    }

    let selectedCounterpartyId = requestedCounterpartyId
    let selectedCounterpartyLabel: string | null = null
    let updatedDocument = document

    if (intent === "link_counterparty") {
      if (!selectedCounterpartyId) {
        return { success: false, error: "Selecciona una contraparte antes de confirmar el vínculo" }
      }

      const counterparty = await getCounterpartyById(
        selectedCounterpartyId,
        fiscalProfileAccess.profile.id
      )

      if (!counterparty) {
        return { success: false, error: "La contraparte seleccionada ya no existe" }
      }

      selectedCounterpartyLabel = counterparty.displayName
    }

    if (intent === "create_counterparty_and_link") {
      if (!counterpartyDisplayName) {
        return { success: false, error: "El nombre de la nueva contraparte es obligatorio" }
      }

      const counterparty = await upsertCounterparty(fiscalProfileAccess.profile.id, {
        displayName: counterpartyDisplayName,
        taxId: counterpartyTaxId,
        countryCode: "ES",
        isActive: true,
      })

      selectedCounterpartyId = counterparty.id
      selectedCounterpartyLabel = counterparty.displayName
    }

    if (intent !== "keep_counterparty_in_review") {
      const nextDocument = buildTransactionFiscalPanelDocumentInput(document, {
        intent,
        paymentDate,
        periodKey,
        counterpartyId: selectedCounterpartyId,
        vatCashAccountingEnabled: fiscalProfileAccess.profile.vatCashAccountingEnabled,
        assignedAt,
      })

      updatedDocument = await upsertTransactionFiscal(
        fiscalProfileAccess.profile.id,
        nextDocument,
        undefined,
        {
          vatCashAccountingEnabled: fiscalProfileAccess.profile.vatCashAccountingEnabled,
          assignedAt,
          occurredAt: assignedAt,
          auditActor: {
            type: "user",
            id: user.id,
          },
          auditReason: buildTransactionFiscalPanelAuditReason(
            intent,
            periodKey,
            paymentDate,
            selectedCounterpartyLabel,
            counterpartyResolutionNote
          ),
        }
      )
    }

    const counterpartyAuditEvent = getCounterpartyResolutionAuditEvent(intent)

    if (counterpartyAuditEvent) {
      await appendFiscalAuditEvent(fiscalProfileAccess.profile.id, {
        event: counterpartyAuditEvent,
        fiscalDocumentId: document.header.fiscal_document_id,
        actor: {
          type: "user",
          id: user.id,
        },
        reason: buildTransactionFiscalPanelAuditReason(
          intent,
          periodKey,
          paymentDate,
          selectedCounterpartyLabel,
          counterpartyResolutionNote
        ),
        occurredAt: assignedAt,
        details: {
          rule_version: "counterparty-resolution/v1",
          previous_counterparty_id: document.header.counterparty_id,
          chosen_counterparty_id: updatedDocument.header.counterparty_id,
          detected_counterparty_name: document.header.counterparty_name,
          detected_counterparty_tax_id: document.header.counterparty_tax_id,
          operator_note: counterpartyResolutionNote,
        },
      })
    }

    revalidatePath(`/transactions/${sourceTransactionId}`)
    revalidatePath("/tax/review")
    revalidatePath("/tax/quarters")
    revalidatePath("/tax/close")
    revalidatePath("/tax/archive")

    if (intent === "create_counterparty_and_link") {
      revalidatePath("/tax/counterparties")
    }

    for (const affectedPeriodKey of collectAffectedPeriodKeys(document.header, updatedDocument.header)) {
      revalidatePath(`/tax/quarters/${affectedPeriodKey}`)
      revalidatePath(`/tax/archive/${affectedPeriodKey}`)
    }

    return {
      success: true,
      data: updatedDocument,
    }
  } catch (error) {
    console.error("Failed to update transaction fiscal panel:", error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "No se ha podido guardar el panel fiscal de la transacción",
    }
  }
}
