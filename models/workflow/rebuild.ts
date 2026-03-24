import {
  WORKFLOW_ITEM_STATUS,
  WORKFLOW_MATERIALITY,
  type WorkflowItem,
  type WorkflowReadModel,
} from "./contracts.ts"
import { buildPeriodClosurePosture } from "./period-closure.ts"

type RebuildInput = {
  readiness: unknown
  items: WorkflowItem[]
}

function statusWeight(status: WorkflowItem["status"]) {
  if (status === WORKFLOW_ITEM_STATUS.BLOCKED) return 0
  if (status === WORKFLOW_ITEM_STATUS.NEEDS_ACTION) return 1
  if (status === WORKFLOW_ITEM_STATUS.READY) return 2
  if (status === WORKFLOW_ITEM_STATUS.FILED) return 3
  if (status === WORKFLOW_ITEM_STATUS.ARCHIVED) return 4
  return 5
}

function materialityWeight(materiality: WorkflowItem["materiality"]) {
  if (materiality === WORKFLOW_MATERIALITY.HIGH) return 0
  if (materiality === WORKFLOW_MATERIALITY.MEDIUM) return 1
  return 2
}

function compareWorkflowItems(left: WorkflowItem, right: WorkflowItem) {
  const statusDelta = statusWeight(left.status) - statusWeight(right.status)
  if (statusDelta !== 0) {
    return statusDelta
  }

  const materialityDelta = materialityWeight(left.materiality) - materialityWeight(right.materiality)
  if (materialityDelta !== 0) {
    return materialityDelta
  }

  return left.title.localeCompare(right.title)
}

export function buildWorkflowReadModelFromSlices<TReadiness>(
  input: Omit<RebuildInput, "readiness"> & { readiness: TReadiness }
): WorkflowReadModel<TReadiness> {
  const items = [...input.items].sort(compareWorkflowItems)
  const blockedCount = items.filter((item) => item.status === WORKFLOW_ITEM_STATUS.BLOCKED).length
  const needsActionCount = items.filter((item) => item.status === WORKFLOW_ITEM_STATUS.NEEDS_ACTION).length
  const readyToFileCount = items.filter((item) => item.status === WORKFLOW_ITEM_STATUS.READY).length
  const filedCount = items.filter((item) => item.status === WORKFLOW_ITEM_STATUS.FILED).length
  const archived = items.length > 0 && items.every((item) => item.status === WORKFLOW_ITEM_STATUS.ARCHIVED)

  return {
    readiness: input.readiness,
    items,
    topItem: items[0] ?? null,
    posture: buildPeriodClosurePosture({
      blockedCount,
      needsActionCount,
      readyToFileCount,
      filedCount,
      archived,
    }),
  }
}
