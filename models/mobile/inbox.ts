import { ACTIVE_ANALYSIS_JOB_STATUSES } from "../../lib/analysis-jobs.ts"
import {
  getMobileConfidence,
  getMobileReviewReason,
  getMobileSystemStatus,
  isActiveMobileInboxFile,
  readMobileTriageMetadata,
} from "../../lib/mobile-triage.ts"
import {
  MOBILE_ITEM_STATE,
  MOBILE_REASON_CODE,
  type MobileInboxItem,
  type MobileSystemStatus,
} from "./types.ts"

type MobileUser = {
  id: string
  organizationId: string
  storageLimit: number
  storageUsed: number
}

type MobileFileRecord = {
  id: string
  userId: string
  organizationId: string
  filename: string
  mimetype: string
  createdAt: Date
  isReviewed: boolean
  metadata: Record<string, unknown> | null
  cachedParseResult: unknown
}

type MobileAnalysisJobRecord = {
  id: string
  fileId: string
  status: string
  error: string | null
  updatedAt: Date
}

type CreateMobileInboxResponseInput = {
  user: MobileUser
  files: MobileFileRecord[]
  jobsByFileId: Map<string, MobileAnalysisJobRecord[]>
}

type MobileInboxDependencies = {
  getSystemStatus?: (user: MobileUser) => Promise<MobileSystemStatus>
}

type MobileInboxStoreDependencies = {
  findFiles?: (user: MobileUser) => Promise<MobileFileRecord[]>
  findJobs?: (user: MobileUser, fileIds: string[]) => Promise<MobileAnalysisJobRecord[]>
  getSystemStatus?: (user: MobileUser) => Promise<MobileSystemStatus>
}

function getMobileTriageMetadata(file: MobileFileRecord) {
  return readMobileTriageMetadata(file.metadata)
}

function isActiveAnalysisJob(status: string) {
  return ACTIVE_ANALYSIS_JOB_STATUSES.includes(status as (typeof ACTIVE_ANALYSIS_JOB_STATUSES)[number])
}

function isParsedMobileDocument(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function getLastUpdatedAt(file: MobileFileRecord, job: MobileAnalysisJobRecord | null) {
  const triage = getMobileTriageMetadata(file)
  if (triage && typeof triage.lastMobileActionAt === "string" && triage.lastMobileActionAt) {
    return triage.lastMobileActionAt
  }

  if (job) {
    return job.updatedAt.toISOString()
  }

  return file.createdAt.toISOString()
}

function buildMobileInboxItem(
  file: MobileFileRecord,
  jobs: MobileAnalysisJobRecord[],
  systemStatus: MobileSystemStatus
): MobileInboxItem {
  const latestJob = jobs[0] || null
  const triage = getMobileTriageMetadata(file)
  const lastUpdatedAt = getLastUpdatedAt(file, latestJob)

  if (triage?.reasonCode === MOBILE_REASON_CODE.ANALYSIS_FAILED) {
    return {
      fileId: file.id,
      filename: file.filename,
      previewUrl: `/files/preview/${file.id}`,
      state: MOBILE_ITEM_STATE.ERROR,
      reasonCode: MOBILE_REASON_CODE.ANALYSIS_FAILED,
      confidence: null,
      analysisJobId: latestJob?.id || null,
      updatedAt: lastUpdatedAt,
    }
  }

  if (triage?.disposition === "deferred") {
    return {
      fileId: file.id,
      filename: file.filename,
      previewUrl: `/files/preview/${file.id}`,
      state: MOBILE_ITEM_STATE.DEFERRED_TO_DESKTOP,
      reasonCode: triage.reasonCode || MOBILE_REASON_CODE.USER_DEFERRED,
      confidence: null,
      analysisJobId: latestJob?.id || null,
      updatedAt: lastUpdatedAt,
    }
  }

  if (latestJob?.status === "failed") {
    return {
      fileId: file.id,
      filename: file.filename,
      previewUrl: `/files/preview/${file.id}`,
      state: MOBILE_ITEM_STATE.ERROR,
      reasonCode: MOBILE_REASON_CODE.ANALYSIS_FAILED,
      confidence: null,
      analysisJobId: latestJob.id,
      updatedAt: lastUpdatedAt,
    }
  }

  if (latestJob && isActiveAnalysisJob(latestJob.status)) {
    return {
      fileId: file.id,
      filename: file.filename,
      previewUrl: `/files/preview/${file.id}`,
      state: MOBILE_ITEM_STATE.ANALYZING,
      reasonCode: systemStatus.workerAvailable ? null : MOBILE_REASON_CODE.WORKER_UNAVAILABLE,
      confidence: null,
      analysisJobId: latestJob.id,
      updatedAt: lastUpdatedAt,
    }
  }

  if (isParsedMobileDocument(file.cachedParseResult)) {
    return {
      fileId: file.id,
      filename: file.filename,
      previewUrl: `/files/preview/${file.id}`,
      state: MOBILE_ITEM_STATE.READY_FOR_REVIEW,
      reasonCode: getMobileReviewReason(file.cachedParseResult),
      confidence: getMobileConfidence(file.cachedParseResult),
      analysisJobId: latestJob?.id || null,
      updatedAt: lastUpdatedAt,
    }
  }

  return {
    fileId: file.id,
    filename: file.filename,
    previewUrl: `/files/preview/${file.id}`,
    state: MOBILE_ITEM_STATE.DEFERRED_TO_DESKTOP,
    reasonCode: systemStatus.blockingReasonCode,
    confidence: null,
    analysisJobId: latestJob?.id || null,
    updatedAt: lastUpdatedAt,
  }
}

async function createDefaultSystemStatus(user: MobileUser) {
  const { getSettings, getLLMSettings } = await import("../settings.ts")
  const { getTenantStorageUsed } = await import("../../lib/files.ts")
  const settings = await getSettings(user.organizationId)
  const llmConfigured = getLLMSettings(settings).providers.length > 0
  const storageUsed = await getTenantStorageUsed({
    organizationId: user.organizationId,
  })

  return getMobileSystemStatus({
    llmConfigured,
    storageAvailable: user.storageLimit < 0 || storageUsed < user.storageLimit,
  })
}

function groupJobsByFileId(jobs: MobileAnalysisJobRecord[]) {
  const jobsByFileId = new Map<string, MobileAnalysisJobRecord[]>()

  for (const job of jobs) {
    const existing = jobsByFileId.get(job.fileId)
    if (existing) {
      existing.push(job)
      continue
    }

    jobsByFileId.set(job.fileId, [job])
  }

  return jobsByFileId
}

export async function createMobileInboxResponse(
  input: CreateMobileInboxResponseInput,
  dependencies: MobileInboxDependencies = {}
) {
  const getSystemStatus = dependencies.getSystemStatus || createDefaultSystemStatus
  const systemStatus = await getSystemStatus(input.user)

  return {
    items: input.files.map((file) => buildMobileInboxItem(file, input.jobsByFileId.get(file.id) || [], systemStatus)),
    systemStatus,
  }
}

export async function getMobileInbox(
  user: MobileUser,
  dependencies: MobileInboxStoreDependencies = {}
) {
  const findFiles =
    dependencies.findFiles ||
    (async (user: MobileUser) => {
      const { prisma } = await import("../../lib/db.ts")
      return prisma.file.findMany({
        where: {
          userId: user.id,
          organizationId: user.organizationId,
          isReviewed: false,
        },
        orderBy: {
          createdAt: "desc",
        },
      }) as Promise<MobileFileRecord[]>
    })

  const findJobs =
    dependencies.findJobs ||
    (async (user: MobileUser, fileIds: string[]) => {
      if (fileIds.length === 0) {
        return []
      }

      const { prisma } = await import("../../lib/db.ts")
      return prisma.analysisJob.findMany({
        where: {
          userId: user.id,
          organizationId: user.organizationId,
          fileId: {
            in: fileIds,
          },
        },
        orderBy: [
          { updatedAt: "desc" },
          { createdAt: "desc" },
        ],
      }) as Promise<MobileAnalysisJobRecord[]>
    })

  const files = (await findFiles(user)).filter(
    (file) => file.organizationId === user.organizationId && isActiveMobileInboxFile(file)
  )
  const jobs = await findJobs(
    user,
    files.map((file) => file.id)
  )

  return createMobileInboxResponse(
    {
      user,
      files,
      jobsByFileId: groupJobsByFileId(jobs),
    },
    {
      getSystemStatus: dependencies.getSystemStatus,
    }
  )
}

export { MOBILE_ITEM_STATE, MOBILE_REASON_CODE }
