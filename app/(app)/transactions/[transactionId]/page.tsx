import { FormTextarea } from "@/components/forms/simple"
import { FiscalPanel } from "@/components/transactions/fiscal-panel"
import TransactionEditForm from "@/components/transactions/edit"
import TransactionFiles from "@/components/transactions/transaction-files"
import { Card } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import config from "@/lib/config"
import { createTranslator } from "@/lib/i18n"
import { requireCurrentOrganizationId } from "@/lib/tenant"
import {
  getLegacyTransactionWorkflowDetailView,
  getTransactionWorkflowDetailView,
  type TransactionWorkflowDetailView,
} from "@/models/workflow/transaction-read-api"
import Link from "next/link"
import { notFound } from "next/navigation"

export default async function TransactionPage({ params }: { params: Promise<{ transactionId: string }> }) {
  const t = createTranslator()
  const { transactionId } = await params
  const user = await getCurrentUser()
  const organizationId = await requireCurrentOrganizationId({
    getCurrentUser: async () => user,
  })
  const loadTransactionWorkflowDetailView = config.workflow.transactionsSliceEnabled
    ? getTransactionWorkflowDetailView
    : getLegacyTransactionWorkflowDetailView

  const view: TransactionWorkflowDetailView | null = await loadTransactionWorkflowDetailView({
    organizationId,
    transactionId,
    userId: user.id,
  })

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
