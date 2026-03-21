import { ExportTransactionsDialog } from "@/components/export/transactions"
import { UploadButton } from "@/components/files/upload-button"
import { TransactionSearchAndFilters } from "@/components/transactions/filters"
import { TransactionList } from "@/components/transactions/list"
import { NewTransactionDialog } from "@/components/transactions/new"
import { Pagination } from "@/components/transactions/pagination"
import { Button } from "@/components/ui/button"
import { getCurrentUser } from "@/lib/auth"
import { createPageMetadata, createTranslator } from "@/lib/i18n"
import { getCategories } from "@/models/categories"
import { getFields } from "@/models/fields"
import { getProjects } from "@/models/projects"
import { getTransactions, TransactionFilters } from "@/models/transactions"
import { Download, Plus, Upload } from "lucide-react"
import { redirect } from "next/navigation"

export const metadata = createPageMetadata("transactions.title", {
  descriptionKey: "transactions.description",
})

const TRANSACTIONS_PER_PAGE = 500

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<TransactionFilters> }) {
  const t = createTranslator()
  const { page, ...filters } = await searchParams
  const user = await getCurrentUser()
  const { transactions, total } = await getTransactions(user.id, filters, {
    limit: TRANSACTIONS_PER_PAGE,
    offset: ((page ?? 1) - 1) * TRANSACTIONS_PER_PAGE,
  })
  const categories = await getCategories(user.id)
  const projects = await getProjects(user.id)
  const fields = await getFields(user.id)

  // Reset page if user clicks a filter and no transactions are found
  if (page && page > 1 && transactions.length === 0) {
    const params = new URLSearchParams(filters as Record<string, string>)
    redirect(`?${params.toString()}`)
  }

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-2 mb-8">
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

      <TransactionSearchAndFilters categories={categories} projects={projects} fields={fields} />

      <main>
        <TransactionList transactions={transactions} fields={fields} />

        {total > TRANSACTIONS_PER_PAGE && <Pagination totalItems={total} itemsPerPage={TRANSACTIONS_PER_PAGE} />}

        {transactions.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 h-full min-h-[400px]">
            <p className="text-muted-foreground">{t("transactions.emptyState")}</p>
            <div className="flex flex-row gap-5 mt-8">
              <UploadButton>
                <Upload /> {t("transactions.analyzeNewInvoice")}
              </UploadButton>
              <NewTransactionDialog>
                <Button variant="outline">
                  <Plus />
                  {t("transactions.addManually")}
                </Button>
              </NewTransactionDialog>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
