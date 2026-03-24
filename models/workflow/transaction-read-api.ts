// Stable public facade for transaction workflow readers. Keep imports targeting this file.
import type { TransactionWorkflowDetailView } from "./transactions/types.ts"

export type {
  FiscalPanelCounterpartyOption,
  FiscalPanelPeriodOption,
  TransactionDetailBaseDependencies,
  TransactionDetailFiscalDependencies,
  TransactionDetailWorkflowDependencies,
  TransactionsWorkflowDependencies,
  TransactionsWorkflowView,
  TransactionWorkflowDetailView,
} from "./transactions/types.ts"
export { getTransactionWorkflowDetailView } from "./transactions/detail-view.ts"
export { getTransactionsWorkflowView } from "./transactions/list-view.ts"

export async function getLegacyTransactionWorkflowDetailView(input: {
  organizationId: string
  transactionId: string
  userId: string
}): Promise<TransactionWorkflowDetailView | null> {
  const legacyDetailViewModule = await import("./transactions/legacy-detail-view.ts")
  return legacyDetailViewModule.getLegacyTransactionWorkflowDetailView(input)
}
