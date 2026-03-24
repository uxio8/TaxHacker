import type { AttentionPriority, AttentionSummary, AttentionSurface } from "../../lib/attention-contract.ts"
import type { ReadinessSummary } from "../../lib/readiness.ts"
import type { UnsortedInboxSummary } from "../unsorted-inbox.ts"
import {
  PERIOD_CLOSURE_POSTURE,
  WORKFLOW_CONFIDENCE,
  WORKFLOW_ITEM_SOURCE,
  WORKFLOW_ITEM_STATUS,
  WORKFLOW_MATERIALITY,
  WORKFLOW_SURFACE,
  type WorkflowItem,
  type WorkflowItemSource,
  type WorkflowReadModel,
  type WorkflowSurface,
} from "./contracts.ts"
import { buildDocumentWorkflowItems } from "./projectors/documents.ts"
import { buildWorkflowReadModelFromSlices } from "./rebuild.ts"

// Stable public workflow facade for generic attention/readiness adapters. Keep callers on this
// module even if the underlying projectors or slice-specific readers move later.

function mapAttentionSurface(surface: AttentionSurface): WorkflowSurface {
  if (surface === "settings") return WORKFLOW_SURFACE.SETTINGS
  if (surface === "unsorted") return WORKFLOW_SURFACE.UNSORTED
  if (surface === "transactions") return WORKFLOW_SURFACE.TRANSACTIONS
  if (surface === "tax") return WORKFLOW_SURFACE.TAX
  if (surface === "capture") return WORKFLOW_SURFACE.CAPTURE
  return WORKFLOW_SURFACE.DASHBOARD
}

function mapAttentionPriority(priority: AttentionPriority) {
  if (priority === "critical" || priority === "high") {
    return WORKFLOW_MATERIALITY.HIGH
  }

  if (priority === "medium") {
    return WORKFLOW_MATERIALITY.MEDIUM
  }

  return WORKFLOW_MATERIALITY.LOW
}

function mapAttentionSource(surface: AttentionSurface, itemId: string): WorkflowItemSource {
  if (itemId.startsWith("setup_")) {
    return WORKFLOW_ITEM_SOURCE.READINESS
  }

  if (surface === "transactions") {
    return WORKFLOW_ITEM_SOURCE.TRANSACTIONS
  }

  if (surface === "tax") {
    return WORKFLOW_ITEM_SOURCE.FISCAL
  }

  if (surface === "unsorted" || surface === "capture") {
    return WORKFLOW_ITEM_SOURCE.DOCUMENTS
  }

  return WORKFLOW_ITEM_SOURCE.READINESS
}

export function buildWorkflowItemsFromAttentionSummary(summary: AttentionSummary): WorkflowItem[] {
  return summary.items.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    href: item.href,
    count: item.count,
    status: item.state === "blocked" ? WORKFLOW_ITEM_STATUS.BLOCKED : WORKFLOW_ITEM_STATUS.NEEDS_ACTION,
    source: mapAttentionSource(item.recommendedSurface, item.id),
    recommendedSurface: mapAttentionSurface(item.recommendedSurface),
    materiality: mapAttentionPriority(item.priority),
    confidence: WORKFLOW_CONFIDENCE.CONFIRMED,
    owner: null,
    dueAt: null,
    nextAction: {
      kind: "open",
      label: item.nextActionLabel,
      href: item.href,
    },
    blockingReason: null,
    requiresDesktop: false,
  }))
}

export function buildWorkflowDocumentItemsFromUnsortedInbox(items: UnsortedInboxSummary[]): WorkflowItem[] {
  return buildDocumentWorkflowItems(items)
}

export function buildWorkflowReadModelFromAttention(
  summary: AttentionSummary
): WorkflowReadModel<ReadinessSummary> {
  return buildWorkflowReadModelFromSlices({
    readiness: summary.readiness,
    items: buildWorkflowItemsFromAttentionSummary(summary),
  })
}

export function isWorkflowPostureTerminal(code: string) {
  return code === PERIOD_CLOSURE_POSTURE.FILED || code === PERIOD_CLOSURE_POSTURE.ARCHIVED
}
