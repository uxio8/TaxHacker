import { getCategories } from "../../categories.ts"
import { getCurrencies } from "../../currencies.ts"
import { getFields } from "../../fields.ts"
import { getFilesByTransactionId } from "../../files.ts"
import {
  buildCounterpartyResolutionDocumentInput,
  mapCounterpartiesToResolutionInput,
  resolveCounterpartyResolution,
} from "../../fiscal/counterparty-resolution.ts"
import { getCounterparties } from "../../fiscal/counterparties.ts"
import { getFiscalProfileAccessByOrganizationId } from "../../fiscal/profile.ts"
import { getFiscalPeriodByKey, syncDefaultSpanishFiscalPeriodsV1 } from "../../fiscal/periods.ts"
import { getTransactionFiscalBySourceTransactionId } from "../../fiscal/transaction-fiscal.ts"
import { getProjects } from "../../projects.ts"
import { getSettings } from "../../settings.ts"
import { getTransactionAttentionSignals, getTransactionById } from "../../transactions.ts"
import { buildFiscalLockMessage, getFiscalPeriodStatusLabel } from "./shared.ts"
import type { FiscalPanelPeriodOption, TransactionWorkflowDetailView } from "./types.ts"
import type { Field } from "../../../prisma/client"

function incompleteTransactionFields(
  fields: Field[],
  transaction: Record<string, unknown> & { extra?: unknown }
) {
  const requiredFields = fields.filter((field) => field.isRequired)
  const extra =
    transaction.extra && typeof transaction.extra === "object" && !Array.isArray(transaction.extra)
      ? (transaction.extra as Record<string, unknown>)
      : null

  return requiredFields.filter((field) => {
    const value = field.isExtra ? extra?.[field.code] : transaction[field.code]
    return value === undefined || value === null || value === ""
  })
}

export async function getLegacyTransactionWorkflowDetailView(input: {
  organizationId: string
  transactionId: string
  userId: string
}): Promise<TransactionWorkflowDetailView | null> {
  const transaction = await getTransactionById(input.transactionId, input.organizationId)

  if (!transaction) {
    return null
  }

  const [files, categories, currencies, settings, fields, projects, fiscalProfileAccess] =
    await Promise.all([
      getFilesByTransactionId(input.transactionId, input.organizationId),
      getCategories(input.organizationId),
      getCurrencies(input.organizationId),
      getSettings(input.organizationId),
      getFields(input.organizationId),
      getProjects(input.organizationId),
      getFiscalProfileAccessByOrganizationId(input.organizationId, input.userId),
    ])

  const incompleteFields = incompleteTransactionFields(fields, transaction)
  const attentionSignals = getTransactionAttentionSignals(transaction, fields)
  const fiscalPanel: TransactionWorkflowDetailView["fiscalPanel"] = {
    profileStatus: fiscalProfileAccess.status,
    document: null,
    periodOptions: [],
    paymentDateLockMessage: null,
    vatLockMessage: null,
    withholdingLockMessage: null,
    counterpartyOptions: [],
    counterpartyResolution: null,
  }

  if (fiscalProfileAccess.status === "ready") {
    const referenceDate = transaction.issuedAt ?? new Date()
    const [document, periods, counterparties] = await Promise.all([
      getTransactionFiscalBySourceTransactionId(input.transactionId, fiscalProfileAccess.profile.id),
      syncDefaultSpanishFiscalPeriodsV1(fiscalProfileAccess.profile.id, { referenceDate }),
      getCounterparties(fiscalProfileAccess.profile.id),
    ])

    fiscalPanel.document = document
    fiscalPanel.counterpartyOptions = counterparties.map((counterparty) => ({
      id: counterparty.id,
      displayName: counterparty.displayName,
      taxId: counterparty.taxId,
      isActive: counterparty.isActive,
    }))

    const periodMap = new Map<string, FiscalPanelPeriodOption>(
      periods.map((period) => [
        period.periodKey,
        {
          periodKey: period.periodKey,
          label: `${period.periodKey} · ${getFiscalPeriodStatusLabel(period.status)}`,
          status: period.status,
        },
      ])
    )

    for (const assignment of [
      document?.header.vat_period_assignment,
      document?.header.withholding_period_assignment,
    ]) {
      if (assignment?.period_key && !periodMap.has(assignment.period_key)) {
        const period = await getFiscalPeriodByKey(fiscalProfileAccess.profile.id, assignment.period_key)

        periodMap.set(assignment.period_key, {
          periodKey: assignment.period_key,
          label: `${assignment.period_key} · ${getFiscalPeriodStatusLabel(period?.status ?? null)}`,
          status: period?.status ?? null,
        })
      }
    }

    fiscalPanel.periodOptions = [...periodMap.values()].sort((left, right) =>
      right.periodKey.localeCompare(left.periodKey)
    )

    if (document) {
      if (!document.header.counterparty_id) {
        fiscalPanel.counterpartyResolution = resolveCounterpartyResolution({
          ownerScopeId: fiscalProfileAccess.profile.id,
          document: buildCounterpartyResolutionDocumentInput({
            fiscal_document_id: document.header.fiscal_document_id,
            source_transaction_id: document.header.source_transaction_id,
            document_kind: document.header.document_kind,
            counterparty_id: document.header.counterparty_id,
            counterparty_name: document.header.counterparty_name,
            counterparty_tax_id: document.header.counterparty_tax_id,
            counterparty_role: document.header.counterparty_role,
            issue_date: document.header.issue_date,
            total_payable_cents: document.header.total_payable_cents,
            total_vat_cents: document.header.total_vat_cents,
            total_withholding_cents: document.header.total_withholding_cents,
          }),
          counterparties: mapCounterpartiesToResolutionInput(counterparties),
        })
      }

      const uniqueAffectedKeys = [
        document.header.vat_period_assignment?.period_key,
        document.header.withholding_period_assignment?.period_key,
      ].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index)

      const protectedPeriods = (
        await Promise.all(
          uniqueAffectedKeys.map(async (periodKey) => {
            const period = await getFiscalPeriodByKey(fiscalProfileAccess.profile.id, periodKey)

            if (!period || (period.status !== "closed" && period.status !== "presented")) {
              return null
            }

            return {
              periodKey,
              status: period.status,
            }
          })
        )
      ).filter((period): period is { periodKey: string; status: "closed" | "presented" } => period !== null)

      fiscalPanel.paymentDateLockMessage = buildFiscalLockMessage(
        "Edición de payment_date",
        protectedPeriods
      )
      fiscalPanel.vatLockMessage = buildFiscalLockMessage(
        "Override de IVA",
        protectedPeriods.filter(
          (period) => period.periodKey === document.header.vat_period_assignment?.period_key
        )
      )
      fiscalPanel.withholdingLockMessage = buildFiscalLockMessage(
        "Override de retenciones",
        protectedPeriods.filter(
          (period) => period.periodKey === document.header.withholding_period_assignment?.period_key
        )
      )
    }
  }

  return {
    transaction,
    files,
    categories,
    currencies,
    settings,
    fields,
    projects,
    incompleteFields,
    attentionSignals,
    fiscalPanel,
  }
}
