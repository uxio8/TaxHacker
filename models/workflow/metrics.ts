import {
  PERIOD_CLOSURE_POSTURE,
  WORKFLOW_ITEM_STATUS,
  type PeriodClosurePosture,
  type WorkflowItem,
  type WorkflowReadModel,
  type WorkflowSurface,
} from "./contracts.ts"

type WorkflowParityInput = {
  surface: WorkflowSurface
  legacy: WorkflowReadModel
  next: WorkflowReadModel
}

type WorkflowPostureValidation = {
  code: string
  message: string
}

export type WorkflowParityReport = {
  surface: WorkflowSurface
  hasDrift: boolean
  topItemIds: {
    legacy: string | null
    next: string | null
  }
  deltas: {
    itemCount: number
    blockedCount: number
    needsActionCount: number
    readyToFileCount: number
    filedCount: number
    postureChanged: boolean
    topItemChanged: boolean
  }
}

function countWorkflowItems(items: WorkflowItem[], status: WorkflowItem["status"]) {
  return items.filter((item) => item.status === status).length
}

function validateWorkflowPosture(posture: PeriodClosurePosture): WorkflowPostureValidation | null {
  if (posture.code === PERIOD_CLOSURE_POSTURE.BLOCKED && posture.blockedCount === 0) {
    return {
      code: "blocked_without_blockers",
      message: "La postura bloqueada exige al menos un item bloqueado.",
    }
  }

  if (posture.code === PERIOD_CLOSURE_POSTURE.AT_RISK && posture.needsActionCount === 0) {
    return {
      code: "at_risk_without_actions",
      message: "La postura en riesgo exige al menos un item que requiera acción.",
    }
  }

  if (posture.code === PERIOD_CLOSURE_POSTURE.DEFENDIBLE && posture.readyToFileCount === 0) {
    return {
      code: "defendible_without_ready_items",
      message: "La postura defendible exige al menos un item listo para presentar.",
    }
  }

  if (posture.code === PERIOD_CLOSURE_POSTURE.FILED && posture.filedCount === 0) {
    return {
      code: "filed_without_filed_items",
      message: "La postura presentada exige al menos un item presentado.",
    }
  }

  if (
    posture.code === PERIOD_CLOSURE_POSTURE.ON_TRACK &&
    (posture.blockedCount > 0 ||
      posture.needsActionCount > 0 ||
      posture.readyToFileCount > 0 ||
      posture.filedCount > 0)
  ) {
    return {
      code: "on_track_with_open_signals",
      message: "La postura encarrilada no puede convivir con señales abiertas del workflow.",
    }
  }

  return null
}

export function findInvalidWorkflowPosture(readModel: WorkflowReadModel) {
  return validateWorkflowPosture(readModel.posture)
}

export function findOrphanWorkflowItems(items: WorkflowItem[]) {
  return items
    .filter(
      (item) =>
        !item.href ||
        !item.nextAction.label ||
        (item.nextAction.href == null && item.nextAction.kind === "open")
    )
    .map((item) => item.id)
    .sort((left, right) => left.localeCompare(right))
}

export function buildWorkflowParityReport(input: WorkflowParityInput): WorkflowParityReport {
  const legacyBlockedCount = countWorkflowItems(input.legacy.items, WORKFLOW_ITEM_STATUS.BLOCKED)
  const nextBlockedCount = countWorkflowItems(input.next.items, WORKFLOW_ITEM_STATUS.BLOCKED)
  const legacyNeedsActionCount = countWorkflowItems(input.legacy.items, WORKFLOW_ITEM_STATUS.NEEDS_ACTION)
  const nextNeedsActionCount = countWorkflowItems(input.next.items, WORKFLOW_ITEM_STATUS.NEEDS_ACTION)
  const legacyReadyToFileCount = countWorkflowItems(input.legacy.items, WORKFLOW_ITEM_STATUS.READY)
  const nextReadyToFileCount = countWorkflowItems(input.next.items, WORKFLOW_ITEM_STATUS.READY)
  const legacyFiledCount = countWorkflowItems(input.legacy.items, WORKFLOW_ITEM_STATUS.FILED)
  const nextFiledCount = countWorkflowItems(input.next.items, WORKFLOW_ITEM_STATUS.FILED)
  const topItemIds = {
    legacy: input.legacy.topItem?.id ?? null,
    next: input.next.topItem?.id ?? null,
  }

  const deltas = {
    itemCount: input.next.items.length - input.legacy.items.length,
    blockedCount: nextBlockedCount - legacyBlockedCount,
    needsActionCount: nextNeedsActionCount - legacyNeedsActionCount,
    readyToFileCount: nextReadyToFileCount - legacyReadyToFileCount,
    filedCount: nextFiledCount - legacyFiledCount,
    postureChanged: input.legacy.posture.code !== input.next.posture.code,
    topItemChanged: topItemIds.legacy !== topItemIds.next,
  }

  return {
    surface: input.surface,
    hasDrift: Object.values(deltas).some((delta) => Boolean(delta)),
    topItemIds,
    deltas,
  }
}

export async function measureWorkflowRebuild<TResult>(rebuild: () => Promise<TResult> | TResult) {
  const startedAt = performance.now()
  const result = await rebuild()
  const durationMs = performance.now() - startedAt

  return {
    durationMs,
    result,
  }
}
