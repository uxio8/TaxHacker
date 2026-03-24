import type { UnsortedInboxSummary } from "../../unsorted-inbox.ts"
import {
  WORKFLOW_CONFIDENCE,
  WORKFLOW_ITEM_SOURCE,
  WORKFLOW_ITEM_STATUS,
  WORKFLOW_MATERIALITY,
  WORKFLOW_SURFACE,
  type WorkflowConfidence,
  type WorkflowItem,
} from "../contracts.ts"

function mapInboxStatus(state: UnsortedInboxSummary["state"]) {
  if (state === "needs_setup") {
    return WORKFLOW_ITEM_STATUS.BLOCKED
  }

  if (state === "ready_to_review") {
    return WORKFLOW_ITEM_STATUS.READY
  }

  return WORKFLOW_ITEM_STATUS.NEEDS_ACTION
}

function mapInboxConfidence(confidenceCode: UnsortedInboxSummary["confidenceCode"]): WorkflowConfidence {
  if (confidenceCode === "high") return WORKFLOW_CONFIDENCE.HIGH
  if (confidenceCode === "medium") return WORKFLOW_CONFIDENCE.MEDIUM
  if (confidenceCode === "low") return WORKFLOW_CONFIDENCE.LOW
  return WORKFLOW_CONFIDENCE.UNKNOWN
}

function normalizeBlockingReason(reasonCode: UnsortedInboxSummary["reasonCode"]) {
  return reasonCode
}

function buildDocumentDescription(summary: UnsortedInboxSummary) {
  if (summary.requiresDesktop) {
    return "Documento pendiente de completar en escritorio."
  }

  return summary.description
}

export function buildDocumentWorkflowItems(items: UnsortedInboxSummary[]): WorkflowItem[] {
  return items.map((item) => ({
    id: item.id,
    title: item.stateLabel,
    description: buildDocumentDescription(item),
    href: item.primaryAction.kind === "open_settings" ? item.primaryAction.href : "/unsorted",
    count: 1,
    status: mapInboxStatus(item.state),
    source: WORKFLOW_ITEM_SOURCE.DOCUMENTS,
    recommendedSurface: WORKFLOW_SURFACE.UNSORTED,
    materiality: item.requiresDesktop ? WORKFLOW_MATERIALITY.HIGH : WORKFLOW_MATERIALITY.MEDIUM,
    confidence: mapInboxConfidence(item.confidenceCode),
    owner: null,
    dueAt: null,
    nextAction: {
      kind: item.primaryAction.kind,
      label: item.primaryAction.label,
      href: item.primaryAction.kind === "open_settings" ? item.primaryAction.href : "/unsorted",
    },
    blockingReason: normalizeBlockingReason(item.reasonCode),
    requiresDesktop: item.requiresDesktop,
  }))
}
