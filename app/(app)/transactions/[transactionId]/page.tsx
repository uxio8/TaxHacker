import { FormTextarea } from "@/components/forms/simple"
import { FiscalPanel } from "@/components/transactions/fiscal-panel"
import TransactionEditForm from "@/components/transactions/edit"
import TransactionFiles from "@/components/transactions/transaction-files"
import { Card } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import config from "@/lib/config"
import { createTranslator } from "@/lib/i18n"
import { requireCurrentOrganizationId } from "@/lib/tenant"
import { incompleteTransactionFields } from "@/lib/stats"
import { getCategories } from "@/models/categories"
import { getCurrencies } from "@/models/currencies"
import { getFields } from "@/models/fields"
import { getFilesByTransactionId } from "@/models/files"
import {
  buildCounterpartyResolutionDocumentInput,
  mapCounterpartiesToResolutionInput,
  resolveCounterpartyResolution,
  type CounterpartyResolution,
} from "@/models/fiscal/counterparty-resolution"
import { getCounterparties } from "@/models/fiscal/counterparties"
import { getFiscalProfileAccessByOrganizationId } from "@/models/fiscal/profile"
import { getFiscalPeriodByKey, syncDefaultSpanishFiscalPeriodsV1 } from "@/models/fiscal/periods"
import type { TransactionFiscalDocument } from "@/models/fiscal/transaction-fiscal"
import { getTransactionFiscalBySourceTransactionId } from "@/models/fiscal/transaction-fiscal"
import { getProjects } from "@/models/projects"
import { getSettings } from "@/models/settings"
import { getTransactionAttentionSignals, getTransactionById } from "@/models/transactions"
import {
  getTransactionWorkflowDetailView,
  type TransactionWorkflowDetailView,
} from "@/models/workflow/transaction-read-api"
import Link from "next/link"
import { notFound } from "next/navigation"

function getStatusLabel(status: string | null) {
  if (status === "closed") {
    return "cerrado"
  }

  if (status === "presented") {
    return "presentado"
  }

  if (status === "ready") {
    return "listo"
  }

  if (status === "in_review") {
    return "en revisión"
  }

  if (status === "open") {
    return "abierto"
  }

  return "sin estado"
}

function buildLockMessage(label: string, periods: Array<{ periodKey: string; status: string }>) {
  if (periods.length === 0) {
    return null
  }

  const detail = periods.map((period) => `${period.periodKey} (${getStatusLabel(period.status)})`).join(", ")
  return `${label} bloqueado por periodo fiscal: ${detail}.`
}

type FiscalPanelCounterpartyOption = {
  id: string
  displayName: string
  taxId: string | null
  isActive: boolean
}

export default async function TransactionPage({ params }: { params: Promise<{ transactionId: string }> }) {
  const t = createTranslator()
  const { transactionId } = await params
  const user = await getCurrentUser()
  const organizationId = await requireCurrentOrganizationId({
    getCurrentUser: async () => user,
  })

  let view: TransactionWorkflowDetailView | null = config.workflow.transactionsSliceEnabled
    ? await getTransactionWorkflowDetailView({
        organizationId,
        transactionId,
        userId: user.id,
      })
    : null

  if (!view) {
    const transaction = await getTransactionById(transactionId, organizationId)
    if (!transaction) {
      notFound()
    }

    const [files, categories, currencies, settings, fields, projects, fiscalProfileAccess] =
      await Promise.all([
        getFilesByTransactionId(transactionId, organizationId),
        getCategories(organizationId),
        getCurrencies(organizationId),
        getSettings(organizationId),
        getFields(organizationId),
        getProjects(organizationId),
        getFiscalProfileAccessByOrganizationId(organizationId, user.id),
      ])
    const incompleteFields = incompleteTransactionFields(fields, transaction)
    const attentionSignals = getTransactionAttentionSignals(transaction, fields)
    let fiscalDocument: TransactionFiscalDocument | null = null
    let periodOptions: Array<{ periodKey: string; label: string; status: string | null }> = []
    let paymentDateLockMessage: string | null = null
    let vatLockMessage: string | null = null
    let withholdingLockMessage: string | null = null
    let counterpartyOptions: FiscalPanelCounterpartyOption[] = []
    let counterpartyResolution: CounterpartyResolution | null = null

    if (fiscalProfileAccess.status === "ready") {
      const referenceDate = transaction.issuedAt ?? new Date()
      const [document, periods, counterparties] = await Promise.all([
        getTransactionFiscalBySourceTransactionId(transactionId, fiscalProfileAccess.profile.id),
        syncDefaultSpanishFiscalPeriodsV1(fiscalProfileAccess.profile.id, { referenceDate }),
        getCounterparties(fiscalProfileAccess.profile.id),
      ])

      fiscalDocument = document
      counterpartyOptions = counterparties.map((counterparty) => ({
        id: counterparty.id,
        displayName: counterparty.displayName,
        taxId: counterparty.taxId,
        isActive: counterparty.isActive,
      }))

      const periodMap = new Map<string, { periodKey: string; label: string; status: string | null }>(
        periods.map((period) => [
          period.periodKey,
          {
            periodKey: period.periodKey,
            label: `${period.periodKey} · ${getStatusLabel(period.status)}`,
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
            label: `${assignment.period_key} · ${getStatusLabel(period?.status ?? null)}`,
            status: period?.status ?? null,
          })
        }
      }

      periodOptions = [...periodMap.values()].sort((left, right) =>
        right.periodKey.localeCompare(left.periodKey)
      )

      if (document) {
        if (!document.header.counterparty_id) {
          counterpartyResolution = resolveCounterpartyResolution({
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

        paymentDateLockMessage = buildLockMessage("Edición de payment_date", protectedPeriods)
        vatLockMessage = buildLockMessage(
          "Override de IVA",
          protectedPeriods.filter(
            (period) => period.periodKey === document.header.vat_period_assignment?.period_key
          )
        )
        withholdingLockMessage = buildLockMessage(
          "Override de retenciones",
          protectedPeriods.filter(
            (period) => period.periodKey === document.header.withholding_period_assignment?.period_key
          )
        )
      }
    }

    view = {
      transaction,
      files,
      categories,
      currencies,
      settings,
      fields,
      projects,
      incompleteFields,
      attentionSignals,
      fiscalPanel: {
        profileStatus: fiscalProfileAccess.status,
        document: fiscalDocument,
        periodOptions,
        paymentDateLockMessage,
        vatLockMessage,
        withholdingLockMessage,
        counterpartyOptions,
        counterpartyResolution,
      },
    }
  }

  if (!view) {
    notFound()
  }

  return (
    <div className="flex flex-wrap flex-row items-start justify-center gap-4 max-w-6xl">
      <Card className="w-full flex-1 flex flex-col flex-wrap justify-center items-start overflow-hidden bg-gradient-to-br from-violet-50/80 via-indigo-50/80 to-white border-violet-200/60">
        {view.attentionSignals.length > 0 && (
          <div className="w-full border-b border-amber-200/70 bg-amber-50/70 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-amber-900">Requiere revisión</p>
                <p className="text-sm text-amber-900/80">
                  Corrige estos puntos para dejar el movimiento listo en el libro operativo.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {view.attentionSignals.map((signal) => (
                  <a
                    key={signal.code}
                    href={signal.href}
                    className="rounded-full border border-amber-200 bg-white/80 px-3 py-1 text-xs font-medium text-amber-800 transition hover:bg-white"
                  >
                    {signal.label}
                  </a>
                ))}
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-1 text-sm text-amber-900/80">
              {view.attentionSignals.map((signal) => (
                <p key={`${signal.code}-description`}>{signal.description}</p>
              ))}
            </div>
          </div>
        )}
        {view.incompleteFields.length > 0 && (
          <div className="w-full flex flex-col gap-1 rounded-md bg-yellow-50 p-5">
            <span>
              {t("transactions.incompleteFields", {
                fields: view.incompleteFields.map((field) => field.name).join(", "),
              })}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("transactions.incompleteFieldsHelp")}{" "}
              <Link href="/settings/fields" className="underline">
                {t("common.fields")}
              </Link>
              .
            </span>
          </div>
        )}
        <div id="transaction-edit" className="w-full p-5">
          <TransactionEditForm
            transaction={view.transaction}
            categories={view.categories}
            currencies={view.currencies}
            settings={view.settings}
            fields={view.fields}
            projects={view.projects}
          />

          <div id="transaction-fiscal">
            <FiscalPanel
              transactionId={transactionId}
              profileStatus={view.fiscalPanel.profileStatus}
              document={view.fiscalPanel.document}
              periodOptions={view.fiscalPanel.periodOptions}
              paymentDateLockMessage={view.fiscalPanel.paymentDateLockMessage}
              vatLockMessage={view.fiscalPanel.vatLockMessage}
              withholdingLockMessage={view.fiscalPanel.withholdingLockMessage}
              counterpartyOptions={view.fiscalPanel.counterpartyOptions}
              counterpartyResolution={view.fiscalPanel.counterpartyResolution}
            />
          </div>

          {view.transaction.text && (
            <details className="mt-10">
              <summary className="cursor-pointer text-sm font-medium">{t("transactions.recognizedText")}</summary>
              <Card className="flex items-stretch p-2 max-w-6xl">
                <div className="flex-1">
                  <FormTextarea
                    name="text"
                    defaultValue={view.transaction.text || ""}
                    hideIfEmpty={true}
                    className="w-full h-[400px]"
                  />
                </div>
              </Card>
            </details>
          )}
        </div>
      </Card>

      <div className="w-1/2 max-w-[400px] space-y-4">
        <TransactionFiles transaction={view.transaction} files={view.files} />
      </div>
    </div>
  )
}
