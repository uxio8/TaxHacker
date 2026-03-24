import type { ReadinessSummary } from "../../../lib/readiness.ts"
import {
  WORKFLOW_CONFIDENCE,
  WORKFLOW_ITEM_SOURCE,
  WORKFLOW_ITEM_STATUS,
  WORKFLOW_MATERIALITY,
  WORKFLOW_SURFACE,
  type WorkflowItem,
} from "../contracts.ts"

export function buildReadinessWorkflowItems(readiness: ReadinessSummary): WorkflowItem[] {
  return readiness.steps
    .filter((step) => !step.complete)
    .map((step) => ({
      id: `setup_${step.key}`,
      title: step.title,
      description: step.description,
      href: step.href,
      count: 1,
      status: step.blocking ? WORKFLOW_ITEM_STATUS.BLOCKED : WORKFLOW_ITEM_STATUS.NEEDS_ACTION,
      source: WORKFLOW_ITEM_SOURCE.READINESS,
      recommendedSurface: WORKFLOW_SURFACE.SETTINGS,
      materiality: step.blocking ? WORKFLOW_MATERIALITY.HIGH : WORKFLOW_MATERIALITY.LOW,
      confidence: WORKFLOW_CONFIDENCE.CONFIRMED,
      owner: null,
      dueAt: null,
      nextAction: {
        kind: "open_settings",
        label: step.actionLabel,
        href: step.href,
      },
      blockingReason: step.blocking ? step.key : null,
      requiresDesktop: false,
    }))
}
