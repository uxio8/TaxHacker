export const MOBILE_ITEM_STATE = {
  ANALYZING: "analyzing",
  READY_FOR_REVIEW: "ready_for_review",
  DEFERRED_TO_DESKTOP: "deferred_to_desktop",
  ERROR: "error",
} as const

export type MobileItemState = (typeof MOBILE_ITEM_STATE)[keyof typeof MOBILE_ITEM_STATE]

export const MOBILE_REASON_CODE = {
  UNSUPPORTED_TYPE: "unsupported_type",
  STORAGE_UNAVAILABLE: "storage_unavailable",
  LLM_NOT_CONFIGURED: "llm_not_configured",
  WORKER_UNAVAILABLE: "worker_unavailable",
  ANALYSIS_FAILED: "analysis_failed",
  LOW_CONFIDENCE: "low_confidence",
  MISSING_CRITICAL_FIELDS: "missing_critical_fields",
  USER_DEFERRED: "user_deferred",
} as const

export type MobileReasonCode = (typeof MOBILE_REASON_CODE)[keyof typeof MOBILE_REASON_CODE] | null

export const MOBILE_CONFIDENCE = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
} as const

export type MobileConfidence = (typeof MOBILE_CONFIDENCE)[keyof typeof MOBILE_CONFIDENCE] | null

export interface MobileCaptureItem {
  fileId: string
  filename: string
  previewUrl: string
  state: MobileItemState
  reasonCode: MobileReasonCode
  confidence: MobileConfidence
  analysisJobId: string | null
  updatedAt: string
  inboxUrl: string
  reviewUrl: string | null
}

export interface MobileInboxItem {
  fileId: string
  filename: string
  previewUrl: string
  state: MobileItemState
  reasonCode: MobileReasonCode
  confidence: MobileConfidence
  analysisJobId: string | null
  updatedAt: string
}

export interface MobileSystemStatus {
  llmConfigured: boolean
  workerAvailable: boolean
  storageAvailable: boolean
  blockingReasonCode: MobileReasonCode
}

export interface MobileCaptureSuccessResult {
  ok: true
  items: MobileCaptureItem[]
}

export interface MobileCaptureErrorResult {
  ok: false
  status: number
  error: string
  reasonCode: MobileReasonCode
}

export type MobileCaptureResult = MobileCaptureSuccessResult | MobileCaptureErrorResult
