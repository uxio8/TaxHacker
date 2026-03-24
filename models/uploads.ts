import { randomUUID } from "node:crypto"
import { isOrganizationAccessRestricted } from "./billing/runtime.ts"

export const UPLOAD_DESTINATION = {
  UNSORTED: "unsorted",
  TRANSACTION: "transaction",
} as const

type UploadDestination = (typeof UPLOAD_DESTINATION)[keyof typeof UPLOAD_DESTINATION]
type Awaitable<T> = T | Promise<T>

export interface UploadUser {
  id: string
  organizationId: string
  email: string
  storageLimit: number
  storageUsed: number
  accessStatus?: string | null
  membershipExpiresAt?: Date | string | null
}

export interface UploadTransaction {
  id: string
  files?: unknown
  issuedAt?: Date | string | null
}

export interface UploadMetadata {
  size: number
  lastModified: number
}

export interface UploadedFileRecord {
  id: string
  filename: string
  path: string
  mimetype: string
  isReviewed: boolean
  metadata: UploadMetadata
}

export interface UploadedFileRecordInput extends UploadedFileRecord {
  organizationId?: string
}

export interface UploadStorageTarget {
  destination: UploadDestination
  storedFilename: string
  relativePath: string
  isReviewed: boolean
}

export interface UploadFilesInput {
  user: UploadUser
  files: File[]
  transactionId?: string
}

export interface UploadFilesSuccessResult {
  success: true
  status: number
  error: null
  destination: UploadDestination
  transactionId: string | null
  files: UploadedFileRecord[]
}

export interface UploadFilesErrorResult {
  success: false
  status: number
  error: string
}

export type UploadFilesResult = UploadFilesSuccessResult | UploadFilesErrorResult

type UploadDependencies = {
  createId?: () => string
  isSubscriptionExpired?: (user: UploadUser) => Awaitable<boolean>
  hasAvailableStorage?: (user: UploadUser, totalBytes: number) => Awaitable<boolean>
  getTransactionById?: (transactionId: string, organizationId: string) => Promise<UploadTransaction | null>
  getUserUploadsDirectory?: (user: UploadUser) => Awaitable<string>
  buildUnsortedTarget?: (organizationId: string, fileId: string, file: File) => Awaitable<UploadStorageTarget>
  buildTransactionTarget?: (
    organizationId: string,
    fileId: string,
    file: File,
    transaction: UploadTransaction
  ) => Awaitable<UploadStorageTarget>
  writeStoredFile?: (input: {
    ownerOrganizationId: string
    ownerUploadsDirectory: string
    storedPath: string
    buffer: Buffer
    contentType: string | null
  }) => Promise<unknown>
  createFileRecord?: (userId: string, data: UploadedFileRecordInput) => Promise<UploadedFileRecord>
  updateTransactionFiles?: (transactionId: string, organizationId: string, fileIds: string[]) => Promise<void>
  calculateStorageUsed?: (user: UploadUser) => Promise<number>
  updateUserStorage?: (user: UploadUser, storageUsed: number) => Promise<void>
  deleteStoredFile?: (input: {
    ownerOrganizationId: string
    ownerUploadsDirectory: string
    storedPath: string
  }) => Promise<boolean>
  deleteFileRecord?: (fileId: string, organizationId: string) => Promise<void>
}

function getFileIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function createDefaultDependencies(): Required<UploadDependencies> {
  return {
    createId: () => randomUUID(),
    isSubscriptionExpired: async (user) =>
      isOrganizationAccessRestricted(
        typeof user.accessStatus === "string" ? (user.accessStatus as "enabled" | "grace_period" | "restricted" | "suspended") : null
      ) || Boolean(user.membershipExpiresAt && new Date(user.membershipExpiresAt) < new Date()),
    hasAvailableStorage: async (user, totalBytes) => {
      const { isEnoughStorageToUploadFile } = await import("../lib/files.ts")
      return isEnoughStorageToUploadFile(user as never, totalBytes)
    },
    getTransactionById: async (transactionId, organizationId) => {
      const { getTransactionById } = await import("./transactions.ts")
      return getTransactionById(transactionId, organizationId) as Promise<UploadTransaction | null>
    },
    getUserUploadsDirectory: async (user) => {
      const { getUserUploadsDirectory } = await import("../lib/files.ts")
      return getUserUploadsDirectory(user as never)
    },
    buildUnsortedTarget: async (organizationId, fileId, file) => {
      const { buildDefaultUnsortedUploadTarget } = await import("./upload-targets.ts")
      return buildDefaultUnsortedUploadTarget(organizationId, fileId, file)
    },
    buildTransactionTarget: async (organizationId, fileId, file, transaction) => {
      const { buildDefaultTransactionUploadTarget } = await import("./upload-targets.ts")
      return buildDefaultTransactionUploadTarget(organizationId, fileId, file, transaction)
    },
    writeStoredFile: async (input) => {
      const { putStoredFileBuffer } = await import("../lib/storage/runtime.ts")
      return putStoredFileBuffer({
        ownerOrganizationId: input.ownerOrganizationId,
        ownerUploadsDirectory: input.ownerUploadsDirectory,
        storedPath: input.storedPath,
        body: input.buffer,
        contentType: input.contentType,
      })
    },
    createFileRecord: async (userId, data) => {
      const { createFile } = await import("./files.ts")
      const organizationId = "organizationId" in data && typeof data.organizationId === "string" ? data.organizationId : userId
      const createdFile = await createFile(userId, {
        ...data,
        organizationId,
      })

      return {
        id: createdFile.id,
        filename: createdFile.filename,
        path: createdFile.path,
        mimetype: createdFile.mimetype,
        isReviewed: createdFile.isReviewed,
        metadata: normalizeUploadMetadata(createdFile.metadata, data.metadata),
      }
    },
    updateTransactionFiles: async (transactionId, organizationId, fileIds) => {
      const { updateTransactionFiles } = await import("./transactions.ts")
      await updateTransactionFiles(transactionId, organizationId, fileIds)
    },
    calculateStorageUsed: async (user) => {
      const { getTenantStorageUsed } = await import("../lib/files.ts")
      return getTenantStorageUsed({
        organizationId: user.organizationId,
        userEmailOrId: user.email || user.id,
      })
    },
    updateUserStorage: async (user, storageUsed) => {
      const { syncOrganizationStorageUsageSnapshot } = await import("./billing/usage.ts")
      await syncOrganizationStorageUsageSnapshot({
        organizationId: user.organizationId,
        userId: user.id,
        userEmailOrId: user.email || user.id,
        quantity: storageUsed,
      })
    },
    deleteStoredFile: async (input) => {
      const { deleteStoredFile } = await import("../lib/storage/runtime.ts")
      return deleteStoredFile({
        ownerOrganizationId: input.ownerOrganizationId,
        ownerUploadsDirectory: input.ownerUploadsDirectory,
        storedPath: input.storedPath,
      })
    },
    deleteFileRecord: async (fileId, organizationId) => {
      const { deleteFile } = await import("./files.ts")
      await deleteFile(fileId, organizationId)
    },
  }
}

function createMetadata(file: File): UploadMetadata {
  return {
    size: file.size,
    lastModified: file.lastModified,
  }
}

function normalizeUploadMetadata(metadata: unknown, fallback: UploadMetadata): UploadMetadata {
  if (typeof metadata !== "object" || metadata === null) {
    return fallback
  }

  const size = "size" in metadata && typeof metadata.size === "number" ? metadata.size : fallback.size
  const lastModified =
    "lastModified" in metadata && typeof metadata.lastModified === "number"
      ? metadata.lastModified
      : fallback.lastModified

  return {
    size,
    lastModified,
  }
}

async function rollbackUploadedFiles(
  organizationId: string,
  writtenFilePaths: Array<{
    ownerOrganizationId: string
    ownerUploadsDirectory: string
    storedPath: string
  }>,
  createdFileIds: string[],
  deps: Required<UploadDependencies>
) {
  for (const fileId of createdFileIds.toReversed()) {
    try {
      await deps.deleteFileRecord(fileId, organizationId)
    } catch {
      // best effort rollback
    }
  }

  for (const writtenFile of writtenFilePaths.toReversed()) {
    try {
      await deps.deleteStoredFile(writtenFile)
    } catch {
      // best effort rollback
    }
  }
}

export async function uploadFiles(
  input: UploadFilesInput,
  dependencies: UploadDependencies = {}
): Promise<UploadFilesResult> {
  const deps = {
    ...createDefaultDependencies(),
    ...dependencies,
  }

  if (input.files.length === 0) {
    return {
      success: false,
      status: 400,
      error: "No se han recibido archivos",
    }
  }

  const totalBytes = input.files.reduce((sum, file) => sum + file.size, 0)
  if (!(await deps.hasAvailableStorage(input.user, totalBytes))) {
    return {
      success: false,
      status: 507,
      error: "No hay almacenamiento suficiente para subir archivos",
    }
  }

  if (await deps.isSubscriptionExpired(input.user)) {
    return {
      success: false,
      status: 403,
      error: "Tu suscripcion ha caducado. Amplia el plan o compra una nueva suscripcion.",
    }
  }

  let transaction: UploadTransaction | null = null
  if (input.transactionId) {
    transaction = await deps.getTransactionById(input.transactionId, input.user.organizationId)
    if (!transaction) {
      return {
        success: false,
        status: 404,
        error: "No se ha encontrado la transaccion",
      }
    }
  }

  const uploadsDirectory = await deps.getUserUploadsDirectory(input.user)
  const writtenFilePaths: Array<{
    ownerOrganizationId: string
    ownerUploadsDirectory: string
    storedPath: string
  }> = []
  const createdFileIds: string[] = []
  const uploadedFiles: UploadedFileRecord[] = []

  try {
    for (const file of input.files) {
      const fileId = deps.createId()
      const target = transaction
        ? await deps.buildTransactionTarget(input.user.organizationId, fileId, file, transaction)
        : await deps.buildUnsortedTarget(input.user.organizationId, fileId, file)
      const buffer = Buffer.from(await file.arrayBuffer())

      await deps.writeStoredFile({
        ownerOrganizationId: input.user.organizationId,
        ownerUploadsDirectory: uploadsDirectory,
        storedPath: target.relativePath,
        buffer,
        contentType: file.type || null,
      })
      writtenFilePaths.push({
        ownerOrganizationId: input.user.organizationId,
        ownerUploadsDirectory: uploadsDirectory,
        storedPath: target.relativePath,
      })

      const fileRecord = await deps.createFileRecord(input.user.id, {
        id: fileId,
        organizationId: input.user.organizationId,
        filename: target.storedFilename,
        path: target.relativePath,
        mimetype: file.type,
        isReviewed: target.isReviewed,
        metadata: createMetadata(file),
      })

      createdFileIds.push(fileRecord.id)
      uploadedFiles.push(fileRecord)
    }

    if (transaction) {
      await deps.updateTransactionFiles(transaction.id, input.user.organizationId, [
        ...getFileIds(transaction.files),
        ...uploadedFiles.map((file) => file.id),
      ])
    }

    const storageUsed = await deps.calculateStorageUsed(input.user)
    await deps.updateUserStorage(input.user, storageUsed)
  } catch {
    await rollbackUploadedFiles(input.user.organizationId, writtenFilePaths, createdFileIds, deps)
    return {
      success: false,
      status: 500,
      error: "No se ha podido subir el archivo",
    }
  }

  return {
    success: true,
    status: 201,
    error: null,
    destination: transaction ? UPLOAD_DESTINATION.TRANSACTION : UPLOAD_DESTINATION.UNSORTED,
    transactionId: transaction?.id ?? null,
    files: uploadedFiles,
  }
}

export const uploadFilesForUser = uploadFiles
