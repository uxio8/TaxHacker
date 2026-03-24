import {
  buildCounterpartyResolutionDocumentInput,
  mapCounterpartiesToResolutionInput,
} from "../../fiscal/counterparty-resolution.ts"
import { resolveTransactionDetailBaseDependencies, resolveTransactionDetailFiscalDependencies } from "./dependencies.ts"
import { buildFiscalLockMessage, getFiscalPeriodStatusLabel } from "./shared.ts"
import type {
  FiscalPanelPeriodOption,
  TransactionDetailWorkflowDependencies,
  TransactionWorkflowDetailView,
} from "./types.ts"

export async function getTransactionWorkflowDetailView(
  input: {
    organizationId: string
    transactionId: string
    userId: string
  },
  dependencies: TransactionDetailWorkflowDependencies = {}
): Promise<TransactionWorkflowDetailView | null> {
  const baseDeps = await resolveTransactionDetailBaseDependencies(dependencies)

  const [transaction, files, categories, currencies, settings, fields, projects, fiscalProfileAccess] =
    await Promise.all([
      baseDeps.getTransactionById(input.transactionId, input.organizationId),
      baseDeps.getFilesByTransactionId(input.transactionId, input.organizationId),
      baseDeps.getCategories(input.organizationId),
      baseDeps.getCurrencies(input.organizationId),
      baseDeps.getSettings(input.organizationId),
      baseDeps.getFields(input.organizationId),
      baseDeps.getProjects(input.organizationId),
      baseDeps.getFiscalProfileAccessByOrganizationId(input.organizationId, input.userId),
    ])

  if (!transaction) {
    return null
  }

  const incompleteFields = baseDeps.incompleteTransactionFields(fields, transaction)
  const attentionSignals = baseDeps.getTransactionAttentionSignals(transaction, fields)

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
    const fiscalDeps = await resolveTransactionDetailFiscalDependencies(dependencies)
    const referenceDate = transaction.issuedAt ?? new Date()
    const [document, periods, counterparties] = await Promise.all([
      fiscalDeps.getTransactionFiscalBySourceTransactionId(input.transactionId, fiscalProfileAccess.profile.id),
      fiscalDeps.syncDefaultSpanishFiscalPeriodsV1(fiscalProfileAccess.profile.id, { referenceDate }),
      fiscalDeps.getCounterparties(fiscalProfileAccess.profile.id),
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
        const period = await fiscalDeps.getFiscalPeriodByKey(
          fiscalProfileAccess.profile.id,
          assignment.period_key
        )

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
        fiscalPanel.counterpartyResolution = fiscalDeps.resolveCounterpartyResolution({
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
            const period = await fiscalDeps.getFiscalPeriodByKey(fiscalProfileAccess.profile.id, periodKey)

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
