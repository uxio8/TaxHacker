import { buildTransactionWorkflowItems } from "../projectors/transactions.ts"
import { buildWorkflowReadModelFromSlices } from "../rebuild.ts"
import { resolveTransactionsDependencies } from "./dependencies.ts"
import type { TransactionFilters } from "../../transactions.ts"
import type { TransactionsWorkflowDependencies, TransactionsWorkflowView } from "./types.ts"

export async function getTransactionsWorkflowView(
  input: {
    organizationId: string
    filters: Omit<TransactionFilters, "page">
    page: number
    perPage: number
  },
  dependencies: TransactionsWorkflowDependencies = {}
): Promise<TransactionsWorkflowView> {
  const deps = await resolveTransactionsDependencies(dependencies)

  const [categories, projects, fields, transactionResult] = await Promise.all([
    deps.getCategories(input.organizationId),
    deps.getProjects(input.organizationId),
    deps.getFields(input.organizationId),
    deps.getTransactions(input.organizationId, input.filters, {
      limit: input.perPage,
      offset: (input.page - 1) * input.perPage,
    }),
  ])

  const attentionByTransactionId = Object.fromEntries(
    transactionResult.transactions.map((transaction) => [
      transaction.id,
      deps.getTransactionAttentionSignals(transaction, fields),
    ])
  )

  return {
    categories,
    projects,
    fields,
    transactions: transactionResult.transactions,
    total: transactionResult.total,
    attentionByTransactionId,
    workflow: buildWorkflowReadModelFromSlices({
      readiness: input.filters,
      items: buildTransactionWorkflowItems(
        transactionResult.transactions.map((transaction) => ({
          id: transaction.id,
          title: transaction.name ?? transaction.merchant ?? transaction.id,
          href: `/transactions/${transaction.id}`,
          signals: attentionByTransactionId[transaction.id] ?? [],
        }))
      ),
    }),
  }
}
