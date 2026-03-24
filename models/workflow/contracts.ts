export const WORKFLOW_SURFACE = {
  DASHBOARD: "dashboard",
  SETTINGS: "settings",
  UNSORTED: "unsorted",
  TRANSACTIONS: "transactions",
  TAX: "tax",
  CAPTURE: "capture",
  ARCHIVE: "archive",
} as const

export type WorkflowSurface = (typeof WORKFLOW_SURFACE)[keyof typeof WORKFLOW_SURFACE]

export const WORKFLOW_ITEM_STATUS = {
  BLOCKED: "blocked",
  NEEDS_ACTION: "needs_action",
  READY: "ready",
  FILED: "filed",
  ARCHIVED: "archived",
} as const

export type WorkflowItemStatus = (typeof WORKFLOW_ITEM_STATUS)[keyof typeof WORKFLOW_ITEM_STATUS]

export const WORKFLOW_MATERIALITY = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
} as const

export type WorkflowMateriality = (typeof WORKFLOW_MATERIALITY)[keyof typeof WORKFLOW_MATERIALITY]

export const WORKFLOW_CONFIDENCE = {
  CONFIRMED: "confirmed",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  UNKNOWN: "unknown",
} as const

export type WorkflowConfidence = (typeof WORKFLOW_CONFIDENCE)[keyof typeof WORKFLOW_CONFIDENCE]

export const WORKFLOW_ITEM_SOURCE = {
  READINESS: "readiness",
  DOCUMENTS: "documents",
  FISCAL: "fiscal",
  TRANSACTIONS: "transactions",
  ARCHIVE: "archive",
} as const

export type WorkflowItemSource = (typeof WORKFLOW_ITEM_SOURCE)[keyof typeof WORKFLOW_ITEM_SOURCE]

export const PERIOD_CLOSURE_POSTURE = {
  BLOCKED: "blocked",
  AT_RISK: "at_risk",
  ON_TRACK: "on_track",
  DEFENDIBLE: "defendible",
  FILED: "filed",
  ARCHIVED: "archived",
} as const

export type PeriodClosurePostureCode =
  (typeof PERIOD_CLOSURE_POSTURE)[keyof typeof PERIOD_CLOSURE_POSTURE]

export type WorkflowNextAction = {
  kind: string
  label: string
  href: string | null
}

export type WorkflowItem = {
  id: string
  title: string
  description: string
  href: string
  count: number
  status: WorkflowItemStatus
  source: WorkflowItemSource
  recommendedSurface: WorkflowSurface
  materiality: WorkflowMateriality
  confidence: WorkflowConfidence
  owner: string | null
  dueAt: string | null
  nextAction: WorkflowNextAction
  blockingReason: string | null
  requiresDesktop: boolean
}

export type PeriodClosurePosture = {
  code: PeriodClosurePostureCode
  blockedCount: number
  needsActionCount: number
  readyToFileCount: number
  filedCount: number
}

export type WorkflowReadModel<TReadiness = unknown> = {
  readiness: TReadiness
  items: WorkflowItem[]
  topItem: WorkflowItem | null
  posture: PeriodClosurePosture
}
