import { ExportTransactionsDialog } from "@/components/export/transactions"
import { UploadButton } from "@/components/files/upload-button"
import { TransactionSearchAndFilters } from "@/components/transactions/filters"
import { TransactionList } from "@/components/transactions/list"
import { NewTransactionDialog } from "@/components/transactions/new"
import { Pagination } from "@/components/transactions/pagination"
import { getCurrentUser } from "@/lib/auth"
import { createPageMetadata, createTranslator } from "@/lib/i18n"
import { requireCurrentOrganizationId } from "@/lib/tenant"
import { getCategories } from "@/models/categories"
import { getFields } from "@/models/fields"
import { getProjects } from "@/models/projects"
import {
  buildTransactionSearchParams,
  getTransactionAttentionSignals,
  getTransactions,
  normalizeTransactionFilters,
  TRANSACTION_QUICK_VIEW_OPTIONS,
} from "@/models/transactions"
import { Download, Plus, Upload } from "lucide-react"
import { redirect } from "next/navigation"

export const metadata = createPageMetadata("transactions.title", {
  descriptionKey: "transactions.description",
})

const TRANSACTIONS_PER_PAGE = 500

type TransactionsPageSearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function TransactionsPage({ searchParams }: { searchParams: TransactionsPageSearchParams }) {
  const t = createTranslator()
  const normalizedFilters = normalizeTransactionFilters(await searchParams)
  const { page = 1, ...filters } = normalizedFilters
  const user = await getCurrentUser()
  const organizationId = await requireCurrentOrganizationId({
    getCurrentUser: async () => user,
  })

  const [categories, projects, fields, transactionResult] = await Promise.all([
    getCategories(organizationId),
    getProjects(organizationId),
    getFields(organizationId),
    getTransactions(organizationId, filters, {
      limit: TRANSACTIONS_PER_PAGE,
      offset: (page - 1) * TRANSACTIONS_PER_PAGE,
    }),
  ])
  const { transactions, total } = transactionResult

  if (page > 1 && transactions.length === 0) {
    const params = buildTransactionSearchParams(filters)
    redirect(`/transactions${params.size > 0 ? `?${params.toString()}` : ""}`)
  }

  const attentionByTransactionId = Object.fromEntries(
    transactions.map((transaction) => [transaction.id, getTransactionAttentionSignals(transaction, fields)])
  )

  return (
    <>
      <header className="mb-8 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex flex-row gap-3 md:gap-5">
          <span className="text-3xl font-bold tracking-tight">{t("transactions.title")}</span>
          <span className="text-3xl tracking-tight opacity-20">{total}</span>
        </h2>
        <div className="flex gap-2">
          <ExportTransactionsDialog fields={fields} categories={categories} projects={projects} total={total}>
            <Download /> <span className="hidden md:block">{t("common.actions.export")}</span>
          </ExportTransactionsDialog>
          <NewTransactionDialog>
            <Plus /> <span className="hidden md:block">{t("transactions.addTransaction")}</span>
          </NewTransactionDialog>
        </div>
      </header>

      <TransactionSearchAndFilters
        categories={categories}
        projects={projects}
        fields={fields}
        defaultFilters={normalizedFilters}
        quickViews={TRANSACTION_QUICK_VIEW_OPTIONS}
      />

      <main>
        <TransactionList
          transactions={transactions}
          fields={fields}
          attentionByTransactionId={attentionByTransactionId}
        />

        {total > TRANSACTIONS_PER_PAGE && <Pagination totalItems={total} itemsPerPage={TRANSACTIONS_PER_PAGE} />}

        {transactions.length === 0 && (
          <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-2">
            <p className="text-muted-foreground">{t("transactions.emptyState")}</p>
            <div className="mt-8 flex flex-row gap-5">
              <UploadButton>
                <Upload /> {t("transactions.analyzeNewInvoice")}
              </UploadButton>
              <NewTransactionDialog triggerVariant="outline">
                <Plus />
                {t("transactions.addManually")}
              </NewTransactionDialog>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
