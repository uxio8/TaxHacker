import type { TransactionAttentionSignal } from "../../transactions.ts"
import {
  WORKFLOW_CONFIDENCE,
  WORKFLOW_ITEM_SOURCE,
  WORKFLOW_ITEM_STATUS,
  WORKFLOW_MATERIALITY,
  WORKFLOW_SURFACE,
  type WorkflowItem,
} from "../contracts.ts"

type TransactionWorkflowSignalInput = {
  id: string
  title: string
  href: string
  signals: TransactionAttentionSignal[]
}

function describeSignals(signals: TransactionAttentionSignal[]) {
  return signals.map((signal) => signal.description).join(" ")
}

function computeMateriality(signals: TransactionAttentionSignal[]) {
  if (signals.some((signal) => signal.code === "pending_fiscal")) {
    return WORKFLOW_MATERIALITY.HIGH
  }

  return WORKFLOW_MATERIALITY.MEDIUM
}

export function buildTransactionWorkflowItems(items: TransactionWorkflowSignalInput[]): WorkflowItem[] {
  return items
    .filter((item) => item.signals.length > 0)
    .map((item) => ({
      id: `transaction:${item.id}`,
      title: item.title,
      description: describeSignals(item.signals),
      href: item.href,
      count: item.signals.length,
      status: WORKFLOW_ITEM_STATUS.NEEDS_ACTION,
      source: WORKFLOW_ITEM_SOURCE.TRANSACTIONS,
      recommendedSurface: WORKFLOW_SURFACE.TRANSACTIONS,
      materiality: computeMateriality(item.signals),
      confidence: WORKFLOW_CONFIDENCE.CONFIRMED,
      owner: null,
      dueAt: null,
      nextAction: {
        kind: "open_transaction",
        label: "Abrir movimiento",
        href: item.href,
      },
      blockingReason: item.signals[0]?.code ?? null,
      requiresDesktop: false,
    }))
}
