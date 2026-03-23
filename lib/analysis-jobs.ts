import type { AnalyzeAttachment } from "../ai/attachments"
import type { LLMProvider } from "../ai/providers/llmProvider"

export const ANALYSIS_JOB_STATUS = {
  QUEUED: "queued",
  ACQUIRING_LEASE: "acquiring_lease",
  RUNNING: "running",
  PERSISTING_RESULT: "persisting_result",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const

export type AnalysisJobStatus = (typeof ANALYSIS_JOB_STATUS)[keyof typeof ANALYSIS_JOB_STATUS]

export const ACTIVE_ANALYSIS_JOB_STATUSES = [
  ANALYSIS_JOB_STATUS.QUEUED,
  ANALYSIS_JOB_STATUS.ACQUIRING_LEASE,
  ANALYSIS_JOB_STATUS.RUNNING,
  ANALYSIS_JOB_STATUS.PERSISTING_RESULT,
] as const

export const FINISHED_ANALYSIS_JOB_STATUSES = [
  ANALYSIS_JOB_STATUS.SUCCEEDED,
  ANALYSIS_JOB_STATUS.FAILED,
  ANALYSIS_JOB_STATUS.CANCELLED,
] as const

export type AnalysisJobAttachment = {
  filename: string
  contentType: string
  base64: string
  filePath: string
}

export type AnalysisJobProviderConfig = {
  provider: LLMProvider
  apiKey: string
  model: string
}

export type AnalysisJobPayload = {
  prompt: string
  schema: Record<string, unknown>
  attachments: AnalysisJobAttachment[]
  providers: AnalysisJobProviderConfig[]
}

export function isFinishedAnalysisJobStatus(status: string): status is AnalysisJobStatus {
  return FINISHED_ANALYSIS_JOB_STATUSES.includes(status as (typeof FINISHED_ANALYSIS_JOB_STATUSES)[number])
}

export function toStoredAnalysisJobAttachments(attachments: AnalyzeAttachment[]): AnalysisJobAttachment[] {
  return attachments.map((attachment) => ({
    filename: attachment.filename,
    contentType: attachment.contentType,
    filePath: "",
    base64: attachment.base64,
  }))
}
