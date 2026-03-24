import { WORKFLOW_SURFACE, type WorkflowSurface } from "./contracts.ts"

export const WORKFLOW_FEATURE_FLAG = {
  DASHBOARD: "workflow_dashboard_v1",
  UNSORTED: "workflow_unsorted_v1",
  CAPTURE: "workflow_capture_v1",
  TAX: "workflow_tax_v1",
  ARCHIVE: "workflow_archive_v1",
  TRANSACTIONS: "workflow_transactions_v1",
} as const

export type WorkflowFeatureFlag =
  (typeof WORKFLOW_FEATURE_FLAG)[keyof typeof WORKFLOW_FEATURE_FLAG]

export type WorkflowFeatureFlags = Record<WorkflowFeatureFlag, boolean>

const DEFAULT_WORKFLOW_FEATURE_FLAGS: WorkflowFeatureFlags = {
  [WORKFLOW_FEATURE_FLAG.DASHBOARD]: false,
  [WORKFLOW_FEATURE_FLAG.UNSORTED]: false,
  [WORKFLOW_FEATURE_FLAG.CAPTURE]: false,
  [WORKFLOW_FEATURE_FLAG.TAX]: false,
  [WORKFLOW_FEATURE_FLAG.ARCHIVE]: false,
  [WORKFLOW_FEATURE_FLAG.TRANSACTIONS]: false,
}

const WORKFLOW_SURFACE_TO_FEATURE_FLAG: Partial<Record<WorkflowSurface, WorkflowFeatureFlag>> = {
  [WORKFLOW_SURFACE.DASHBOARD]: WORKFLOW_FEATURE_FLAG.DASHBOARD,
  [WORKFLOW_SURFACE.UNSORTED]: WORKFLOW_FEATURE_FLAG.UNSORTED,
  [WORKFLOW_SURFACE.CAPTURE]: WORKFLOW_FEATURE_FLAG.CAPTURE,
  [WORKFLOW_SURFACE.TAX]: WORKFLOW_FEATURE_FLAG.TAX,
  [WORKFLOW_SURFACE.ARCHIVE]: WORKFLOW_FEATURE_FLAG.ARCHIVE,
  [WORKFLOW_SURFACE.TRANSACTIONS]: WORKFLOW_FEATURE_FLAG.TRANSACTIONS,
}

export function resolveWorkflowFeatureFlags(
  input: Partial<Record<WorkflowFeatureFlag, boolean>> = {}
): WorkflowFeatureFlags {
  return {
    ...DEFAULT_WORKFLOW_FEATURE_FLAGS,
    ...input,
  }
}

export function isWorkflowSurfaceEnabled(
  flags: WorkflowFeatureFlags,
  surface: WorkflowSurface
) {
  const featureFlag = WORKFLOW_SURFACE_TO_FEATURE_FLAG[surface]
  return featureFlag ? flags[featureFlag] : false
}
