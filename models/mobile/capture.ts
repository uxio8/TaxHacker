import { randomUUID } from "node:crypto"
import path from "node:path"

import { getMobileSystemStatus, mergeMobileTriageMetadata } from "../../lib/mobile-triage.ts"
import { buildDefaultUnsortedUploadTarget } from "../upload-targets.ts"
import {
  MOBILE_ITEM_STATE,
  MOBILE_REASON_CODE,
  type MobileCaptureItem,
  type MobileCaptureResult,
} from "./types.ts"

type MobileUser = {
  id: string
  organizationId: string
  email?: string
  storageLimit: number
  storageUsed: number
}

type StoredMobileFile = {
  id: string
  userId?: string
  filename: string
  path: string
  mimetype: string
  metadata: Record<string, unknown>
  cachedParseResult: unknown
  createdAt: Date
}

type AnalysisCapability = {
  supported: boolean
  llmConfigured: boolean
  workerAvailable: boolean
}

type MobileCaptureDependencies = {
  now?: () => Date
  createId?: () => string
  canAcceptMobileMimeType?: (mimeType: string) => boolean
  hasAvailableStorage?: (user: MobileUser, totalBytes: number) => boolean | Promise<boolean>
  getUserUploadsDirectory?: (user: MobileUser) => string
  resolveUnsortedFilePath?: (organizationId: string, fileId: string, filename: string) => string
  writeStoredFile?: (input: {
    ownerOrganizationId: string
    ownerUploadsDirectory: string
    storedPath: string
    buffer: Buffer
    contentType: string | null
  }) => Promise<unknown>
  createFileRecord?: (userId: string, data: Record<string, unknown>) => Promise<StoredMobileFile>
  updateFileRecord?: (fileId: string, organizationId: string, data: Record<string, unknown>) => Promise<unknown>
  updateUserStorage?: (user: MobileUser, storageUsed: number) => Promise<void>
  calculateStorageUsed?: (user: MobileUser) => Promise<number>
  getAnalysisCapability?: (user: MobileUser) => Promise<AnalysisCapability>
  createAnalysisJob?: (user: MobileUser, fileRecord: StoredMobileFile) => Promise<{ id: string; status: string }>
  ensureWorkerAvailable?: (jobId: string) => Promise<boolean>
}

type CaptureMobileFilesInput = {
  user: MobileUser
  files: File[]
}

function createMobileCaptureItem(input: {
  fileId: string
  filename: string
  state: (typeof MOBILE_ITEM_STATE)[keyof typeof MOBILE_ITEM_STATE]
  reasonCode: (typeof MOBILE_REASON_CODE)[keyof typeof MOBILE_REASON_CODE] | null
  confidence?: null
  analysisJobId?: string | null
  updatedAt: string
}): MobileCaptureItem {
  return {
    fileId: input.fileId,
    filename: input.filename,
    previewUrl: `/files/preview/${input.fileId}`,
    state: input.state,
    reasonCode: input.reasonCode,
    confidence: input.confidence ?? null,
    analysisJobId: input.analysisJobId ?? null,
    updatedAt: input.updatedAt,
    inboxUrl: "/capture/inbox",
    reviewUrl: null,
  }
}

function createDefaultDependencies(): Required<MobileCaptureDependencies> {
  return {
    now: () => new Date(),
    createId: () => randomUUID(),
    canAcceptMobileMimeType: (mimeType) => mimeType === "application/pdf" || mimeType.startsWith("image/"),
    hasAvailableStorage: async (user, totalBytes) => {
      const { isEnoughStorageToUploadFile } = await import("../../lib/files.ts")
      return isEnoughStorageToUploadFile(user as never, totalBytes)
    },
    getUserUploadsDirectory: (user) => path.resolve(process.env.UPLOAD_PATH || "./uploads", user.email || user.id),
    resolveUnsortedFilePath: (organizationId, fileId, filename) =>
      buildDefaultUnsortedUploadTarget(organizationId, fileId, new File([], filename)).relativePath,
    writeStoredFile: async (input) => {
      const { putStoredFileBuffer } = await import("../../lib/storage/runtime.ts")
      return putStoredFileBuffer({
        ownerOrganizationId: input.ownerOrganizationId,
        ownerUploadsDirectory: input.ownerUploadsDirectory,
        storedPath: input.storedPath,
        body: input.buffer,
        contentType: input.contentType,
      })
    },
    createFileRecord: async (userId, data) => {
      const { createFile } = await import("../files.ts")
      return createFile(userId, data) as Promise<StoredMobileFile>
    },
    updateFileRecord: async (fileId, organizationId, data) => {
      const { updateFile } = await import("../files.ts")
      return updateFile(fileId, organizationId, data)
    },
    updateUserStorage: async (user, storageUsed) => {
      const { syncOrganizationStorageUsageSnapshot } = await import("../billing/usage.ts")
      await syncOrganizationStorageUsageSnapshot({
        organizationId: user.organizationId,
        userId: user.id,
        userEmailOrId: user.email || user.id,
        quantity: storageUsed,
      })
    },
    calculateStorageUsed: async (user) => {
      const { getTenantStorageUsed } = await import("../../lib/files.ts")
      return getTenantStorageUsed({
        organizationId: user.organizationId,
        userEmailOrId: user.email || user.id,
      })
    },
    getAnalysisCapability: async (user) => {
      const { getSettings, getLLMSettings } = await import("../settings.ts")
      const settings = await getSettings(user.organizationId)
      const llmConfigured = getLLMSettings(settings).providers.length > 0
      const systemStatus = await getMobileSystemStatus({
        llmConfigured,
        storageAvailable: true,
      })

      return {
        supported: true,
        llmConfigured,
        workerAvailable: systemStatus.workerAvailable,
      }
    },
    createAnalysisJob: async (user, fileRecord) => {
      const [{ startAnalysisJobAction }, { getSettings }, { getFields }, { getCategories }, { getProjects }] =
        await Promise.all([
          import("../../app/(app)/unsorted/actions.ts"),
          import("../settings.ts"),
          import("../fields.ts"),
          import("../categories.ts"),
          import("../projects.ts"),
        ])

      const [settings, fields, categories, projects] = await Promise.all([
        getSettings(user.organizationId),
        getFields(user.organizationId),
        getCategories(user.organizationId),
        getProjects(user.organizationId),
      ])

      const result = await startAnalysisJobAction(fileRecord as never, settings, fields, categories, projects)
      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to enqueue mobile analysis job")
      }

      return {
        id: result.data.jobId,
        status: result.data.status,
      }
    },
    ensureWorkerAvailable: async () => true,
  }
}

export async function captureMobileFiles(
  input: CaptureMobileFilesInput,
  dependencies: MobileCaptureDependencies = {}
): Promise<MobileCaptureResult> {
  const deps = {
    ...createDefaultDependencies(),
    ...dependencies,
  }

  if (input.files.length === 0) {
    return {
      ok: false,
      status: 400,
      error: "No files uploaded",
      reasonCode: null,
    }
  }

  const hasUnsupportedType = input.files.some((file) => !deps.canAcceptMobileMimeType(file.type))
  if (hasUnsupportedType) {
    return {
      ok: false,
      status: 400,
      error: "Unsupported file type for mobile capture",
      reasonCode: MOBILE_REASON_CODE.UNSUPPORTED_TYPE,
    }
  }

  const totalBytes = input.files.reduce((sum, file) => sum + file.size, 0)
  if (!(await deps.hasAvailableStorage(input.user, totalBytes))) {
    return {
      ok: false,
      status: 507,
      error: "Storage unavailable for mobile capture",
      reasonCode: MOBILE_REASON_CODE.STORAGE_UNAVAILABLE,
    }
  }

  const uploadsDirectory = deps.getUserUploadsDirectory(input.user)
  const capability = await deps.getAnalysisCapability(input.user)
  const items: MobileCaptureItem[] = []

  for (const file of input.files) {
    const now = deps.now().toISOString()
    const fileId = deps.createId()
    const relativePath = deps.resolveUnsortedFilePath(input.user.organizationId, fileId, file.name)
    const buffer = Buffer.from(await file.arrayBuffer())
    const deferReasonCode = !capability.llmConfigured
      ? MOBILE_REASON_CODE.LLM_NOT_CONFIGURED
      : !capability.workerAvailable
        ? MOBILE_REASON_CODE.WORKER_UNAVAILABLE
        : null

    await deps.writeStoredFile({
      ownerOrganizationId: input.user.organizationId,
      ownerUploadsDirectory: uploadsDirectory,
      storedPath: relativePath,
      buffer,
      contentType: file.type || null,
    })

    const fileRecord = await deps.createFileRecord(input.user.id, {
      id: fileId,
      organizationId: input.user.organizationId,
      filename: file.name,
      path: relativePath,
      mimetype: file.type,
      isReviewed: false,
      metadata: mergeMobileTriageMetadata({
        metadata: null,
        disposition: deferReasonCode ? "deferred" : "pending",
        reasonCode: deferReasonCode,
        updatedAt: now,
      }),
    })

    const storageUsed = await deps.calculateStorageUsed(input.user)
    await deps.updateUserStorage(input.user, storageUsed)

    if (!capability.llmConfigured) {
      items.push(
        createMobileCaptureItem({
          fileId,
          filename: file.name,
          state: MOBILE_ITEM_STATE.DEFERRED_TO_DESKTOP,
          reasonCode: MOBILE_REASON_CODE.LLM_NOT_CONFIGURED,
          updatedAt: now,
        })
      )
      continue
    }

    if (!capability.workerAvailable) {
      items.push(
        createMobileCaptureItem({
          fileId,
          filename: file.name,
          state: MOBILE_ITEM_STATE.DEFERRED_TO_DESKTOP,
          reasonCode: MOBILE_REASON_CODE.WORKER_UNAVAILABLE,
          updatedAt: now,
        })
      )
      continue
    }

    try {
      const job = await deps.createAnalysisJob(input.user, fileRecord)
      await deps.ensureWorkerAvailable(job.id)

      items.push(
        createMobileCaptureItem({
          fileId,
          filename: file.name,
          state: MOBILE_ITEM_STATE.ANALYZING,
          reasonCode: null,
          analysisJobId: job.id,
          updatedAt: now,
        })
      )
    } catch {
      await deps.updateFileRecord(fileRecord.id, input.user.organizationId, {
        metadata: mergeMobileTriageMetadata({
          metadata: fileRecord.metadata,
          disposition: "deferred",
          reasonCode: MOBILE_REASON_CODE.ANALYSIS_FAILED,
          updatedAt: now,
        }),
      })

      items.push(
        createMobileCaptureItem({
          fileId,
          filename: file.name,
          state: MOBILE_ITEM_STATE.ERROR,
          reasonCode: MOBILE_REASON_CODE.ANALYSIS_FAILED,
          updatedAt: now,
        })
      )
    }
  }

  return {
    ok: true,
    items,
  }
}

export { MOBILE_ITEM_STATE }
