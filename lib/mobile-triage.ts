import {
  isAnalysisWorkerHeartbeatFresh,
  isProcessAlive,
  readAnalysisWorkerHeartbeat,
  type AnalysisWorkerHeartbeat,
} from "./analysis-worker-supervisor.ts"
import {
  MOBILE_CONFIDENCE,
  MOBILE_REASON_CODE,
  buildReviewedFileUpdate,
  getMobileConfidence,
  getMobileReviewReason,
  isActiveMobileInboxFile,
  mergeMobileTriageMetadata,
  readMobileTriageMetadata,
} from "./mobile-triage-shared.ts"
import { type MobileReasonCode, type MobileSystemStatus } from "../models/mobile/types.ts"

type MobileSystemStatusInput = {
  storageAvailable: boolean
  llmConfigured: boolean
}

type MobileSystemStatusDependencies = {
  readAnalysisWorkerHeartbeat?: () => Promise<AnalysisWorkerHeartbeat | null>
  isHeartbeatFresh?: (heartbeat: Pick<AnalysisWorkerHeartbeat, "updatedAt">) => boolean
  isProcessAlive?: (pid: number) => boolean
}

export async function getMobileSystemStatus(
  input: MobileSystemStatusInput,
  dependencies: MobileSystemStatusDependencies = {}
): Promise<MobileSystemStatus> {
  const heartbeatReader = dependencies.readAnalysisWorkerHeartbeat || readAnalysisWorkerHeartbeat
  const heartbeatFresh = dependencies.isHeartbeatFresh || isAnalysisWorkerHeartbeatFresh
  const processAlive = dependencies.isProcessAlive || isProcessAlive

  const heartbeat = await heartbeatReader()
  const workerAvailable = Boolean(heartbeat && processAlive(heartbeat.pid) && heartbeatFresh(heartbeat))

  let blockingReasonCode: MobileReasonCode = null
  if (!input.storageAvailable) {
    blockingReasonCode = MOBILE_REASON_CODE.STORAGE_UNAVAILABLE
  } else if (!input.llmConfigured) {
    blockingReasonCode = MOBILE_REASON_CODE.LLM_NOT_CONFIGURED
  } else if (!workerAvailable) {
    blockingReasonCode = MOBILE_REASON_CODE.WORKER_UNAVAILABLE
  }

  return {
    llmConfigured: input.llmConfigured,
    workerAvailable,
    storageAvailable: input.storageAvailable,
    blockingReasonCode,
  }
}

export {
  MOBILE_CONFIDENCE,
  MOBILE_REASON_CODE,
  buildReviewedFileUpdate,
  getMobileConfidence,
  getMobileReviewReason,
  isActiveMobileInboxFile,
  mergeMobileTriageMetadata,
  readMobileTriageMetadata,
}
