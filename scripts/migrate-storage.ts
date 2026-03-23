import { readFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { prisma } from "../lib/db.ts"
import { getStaticDirectory, getUserUploadsDirectory } from "../lib/files.ts"
import { buildTransactionFileName } from "../lib/transaction-file-name.ts"
import { buildStaticAssetUrl } from "../lib/uploads.ts"
import { getStorageProvider, type StoragePutInput } from "../lib/storage/index.ts"
import {
  buildOrganizationStaticObjectKey,
  buildOrganizationTransactionObjectKey,
  buildOrganizationUnsortedObjectKey,
  isCanonicalOrganizationObjectKey,
} from "../lib/storage/keys.ts"
import { resolveStoredFileAbsolutePath } from "../lib/storage/paths.ts"

type MigratableFile = {
  id: string
  userId: string
  organizationId: string
  filename: string
  path: string
  isReviewed: boolean
  createdAt: Date
  metadata?: unknown
}

type MigratableTransaction = {
  id: string
  userId: string
  organizationId: string
  merchant: string | null
  name: string | null
  issuedAt: Date | null
  extra: unknown
  files: unknown
}

type MigratableUser = {
  id: string
  email: string
  defaultOrganizationId: string | null
  avatar: string | null
  businessLogo: string | null
}

type FileMigrationPlan = {
  fileId: string
  organizationId: string
  sourceStoredPath: string
  targetStoredPath: string
  kind: "unsorted" | "transaction"
  reason: "legacy_unsorted" | "legacy_reviewed_transaction" | "legacy_reviewed_fallback"
  filename: string
  shouldUpdateDatabase: boolean
}

type StaticAssetField = "avatar" | "businessLogo"

type StaticAssetMigrationPlan = {
  userId: string
  organizationId: string
  field: StaticAssetField
  sourceStoredPath: string
  targetStoredPath: string
  nextUrl: string
  assetType: "avatar" | "business-logo"
}

type StorageMigrationOptions = {
  dryRun?: boolean
  organizationId?: string | null
  limit?: number | null
}

type StorageMigrationError = {
  kind: "file" | "static"
  id: string
  message: string
}

type StorageMigrationResult = {
  dryRun: boolean
  processedFiles: number
  processedStaticAssets: number
  updatedFiles: number
  updatedStaticAssets: number
  errors: StorageMigrationError[]
}

type ScriptDependencies = {
  listFiles?: (input: { organizationId?: string | null; limit?: number | null }) => Promise<MigratableFile[]>
  listTransactions?: (input: {
    organizationId?: string | null
    fileIds?: string[]
  }) => Promise<MigratableTransaction[]>
  listUsersWithStaticAssets?: (input: {
    organizationId?: string | null
    limit?: number | null
  }) => Promise<MigratableUser[]>
  readLegacyStoredFile?: (input: {
    organizationId: string
    userId: string
    userEmail?: string | null
    storedPath: string
    sourceType: "file" | "static"
  }) => Promise<Buffer>
  putCanonicalObject?: (input: StoragePutInput) => Promise<void>
  updateFilePath?: (fileId: string, nextPath: string, nextFilename: string) => Promise<void>
  updateUserAsset?: (userId: string, field: StaticAssetField, nextUrl: string) => Promise<void>
}

function asArrayOfStrings(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
}

function stripQueryFromUrl(value: string) {
  return value.split("?")[0]?.split("#")[0] || value
}

function normalizeStaticStoredPath(url: string) {
  const normalized = stripQueryFromUrl(url)
  const prefix = "/files/static/"

  if (!normalized.startsWith(prefix)) {
    return null
  }

  return normalized.slice(prefix.length)
}

function resolveAssetType(field: StaticAssetField) {
  return field === "avatar" ? "avatar" : "business-logo"
}

export function buildFileStorageMigrationPlan(input: {
  file: MigratableFile
  linkedTransaction: MigratableTransaction | null
}): FileMigrationPlan | null {
  const { file, linkedTransaction } = input

  if (isCanonicalOrganizationObjectKey(file.path)) {
    return null
  }

  if (!file.isReviewed) {
    return {
      fileId: file.id,
      organizationId: file.organizationId,
      sourceStoredPath: file.path,
      targetStoredPath: buildOrganizationUnsortedObjectKey(file.organizationId, file.id, file.filename),
      kind: "unsorted",
      reason: "legacy_unsorted",
      filename: file.filename,
      shouldUpdateDatabase: true,
    }
  }

  const issuedAt = linkedTransaction?.issuedAt || file.createdAt || new Date()
  const migratedFilename =
    (linkedTransaction ? buildTransactionFileName(file.filename, linkedTransaction) : null) || file.filename

  return {
    fileId: file.id,
    organizationId: file.organizationId,
    sourceStoredPath: file.path,
    targetStoredPath: buildOrganizationTransactionObjectKey(
      file.organizationId,
      file.id,
      migratedFilename,
      issuedAt
    ),
    kind: "transaction",
    reason: linkedTransaction ? "legacy_reviewed_transaction" : "legacy_reviewed_fallback",
    filename: migratedFilename,
    shouldUpdateDatabase: true,
  }
}

export function buildStaticAssetMigrationPlan(input: {
  user: MigratableUser
  field: StaticAssetField
}): StaticAssetMigrationPlan | null {
  const currentUrl = input.user[input.field]
  if (!currentUrl) {
    return null
  }

  const sourceStoredPath = normalizeStaticStoredPath(currentUrl)
  if (!sourceStoredPath) {
    return null
  }

  const organizationId = input.user.defaultOrganizationId || input.user.id
  const assetType = resolveAssetType(input.field)
  const filename = path.basename(sourceStoredPath)
  const targetStoredPath = buildOrganizationStaticObjectKey(
    organizationId,
    assetType,
    input.user.id,
    filename
  )
  const nextUrl = buildStaticAssetUrl(targetStoredPath)

  if (sourceStoredPath === targetStoredPath && stripQueryFromUrl(currentUrl) === nextUrl) {
    return null
  }

  return {
    userId: input.user.id,
    organizationId,
    field: input.field,
    sourceStoredPath,
    targetStoredPath,
    nextUrl,
    assetType,
  }
}

async function defaultListFiles(input: {
  organizationId?: string | null
  limit?: number | null
}): Promise<MigratableFile[]> {
  return prisma.file.findMany({
    where: input.organizationId ? { organizationId: input.organizationId } : undefined,
    orderBy: { createdAt: "asc" },
    take: input.limit ?? undefined,
    select: {
      id: true,
      userId: true,
      organizationId: true,
      filename: true,
      path: true,
      isReviewed: true,
      createdAt: true,
      metadata: true,
    },
  })
}

async function defaultListTransactions(input: {
  organizationId?: string | null
  fileIds?: string[]
}): Promise<MigratableTransaction[]> {
  const transactions = await prisma.transaction.findMany({
    where: input.organizationId ? { organizationId: input.organizationId } : undefined,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      userId: true,
      organizationId: true,
      merchant: true,
      name: true,
      issuedAt: true,
      extra: true,
      files: true,
    },
  })

  if (!input.fileIds?.length) {
    return transactions as MigratableTransaction[]
  }

  const requestedIds = new Set(input.fileIds)
  return (transactions as MigratableTransaction[]).filter((transaction) =>
    asArrayOfStrings(transaction.files).some((fileId) => requestedIds.has(fileId))
  )
}

async function defaultListUsersWithStaticAssets(input: {
  organizationId?: string | null
  limit?: number | null
}): Promise<MigratableUser[]> {
  return prisma.user.findMany({
    where: {
      ...(input.organizationId
        ? {
            memberships: {
              some: {
                organizationId: input.organizationId,
              },
            },
          }
        : {}),
      OR: [{ avatar: { not: null } }, { businessLogo: { not: null } }],
    },
    orderBy: { createdAt: "asc" },
    take: input.limit ?? undefined,
    select: {
      id: true,
      email: true,
      defaultOrganizationId: true,
      avatar: true,
      businessLogo: true,
    },
  })
}

async function defaultReadLegacyStoredFile(input: {
  organizationId: string
  userId: string
  userEmail?: string | null
  storedPath: string
  sourceType: "file" | "static"
}) {
  const uploadsBasePath = path.resolve(process.env.UPLOAD_PATH || "./uploads")

  if (isCanonicalOrganizationObjectKey(input.storedPath)) {
    const absolutePath = resolveStoredFileAbsolutePath({
      storageBasePath: uploadsBasePath,
      ownerUploadsDirectory: uploadsBasePath,
      storedPath: input.storedPath,
    })

    return readFile(absolutePath)
  }

  const ownerEmail = input.userEmail?.trim()
  if (!ownerEmail) {
    throw new Error(`No se puede resolver el namespace legacy del usuario ${input.userId}`)
  }

  if (input.sourceType === "static") {
    return readFile(path.join(getStaticDirectory({ email: ownerEmail } as never), path.basename(input.storedPath)))
  }

  return readFile(
    resolveStoredFileAbsolutePath({
      storageBasePath: uploadsBasePath,
      ownerUploadsDirectory: getUserUploadsDirectory({ email: ownerEmail } as never),
      storedPath: input.storedPath,
    })
  )
}

async function defaultPutCanonicalObject(input: StoragePutInput) {
  await getStorageProvider().put(input)
}

async function defaultUpdateFilePath(fileId: string, nextPath: string, nextFilename: string) {
  await prisma.file.update({
    where: { id: fileId },
    data: {
      path: nextPath,
      filename: nextFilename,
    },
  })
}

async function defaultUpdateUserAsset(userId: string, field: StaticAssetField, nextUrl: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      [field]: nextUrl,
    },
  })
}

function buildTransactionByFileIdMap(transactions: MigratableTransaction[]) {
  const map = new Map<string, MigratableTransaction>()

  for (const transaction of transactions) {
    for (const fileId of asArrayOfStrings(transaction.files)) {
      if (!map.has(fileId)) {
        map.set(fileId, transaction)
      }
    }
  }

  return map
}

function parseArguments(argv: string[]) {
  return argv.reduce<StorageMigrationOptions>(
    (acc, argument) => {
      if (argument === "--dry-run") {
        acc.dryRun = true
      } else if (argument.startsWith("--organization=")) {
        acc.organizationId = argument.slice("--organization=".length) || null
      } else if (argument.startsWith("--limit=")) {
        const parsed = Number(argument.slice("--limit=".length))
        if (Number.isFinite(parsed) && parsed > 0) {
          acc.limit = parsed
        }
      }

      return acc
    },
    {
      dryRun: false,
      organizationId: null,
      limit: null,
    }
  )
}

export async function migrateStorage(
  options: StorageMigrationOptions = {},
  dependencies: ScriptDependencies = {}
): Promise<StorageMigrationResult> {
  const deps = {
    listFiles: dependencies.listFiles ?? defaultListFiles,
    listTransactions: dependencies.listTransactions ?? defaultListTransactions,
    listUsersWithStaticAssets: dependencies.listUsersWithStaticAssets ?? defaultListUsersWithStaticAssets,
    readLegacyStoredFile: dependencies.readLegacyStoredFile ?? defaultReadLegacyStoredFile,
    putCanonicalObject: dependencies.putCanonicalObject ?? defaultPutCanonicalObject,
    updateFilePath: dependencies.updateFilePath ?? defaultUpdateFilePath,
    updateUserAsset: dependencies.updateUserAsset ?? defaultUpdateUserAsset,
  }

  const dryRun = options.dryRun ?? false
  const result: StorageMigrationResult = {
    dryRun,
    processedFiles: 0,
    processedStaticAssets: 0,
    updatedFiles: 0,
    updatedStaticAssets: 0,
    errors: [],
  }

  const files = await deps.listFiles({
    organizationId: options.organizationId ?? null,
    limit: options.limit ?? null,
  })
  const transactions = await deps.listTransactions({
    organizationId: options.organizationId ?? null,
    fileIds: files.map((file) => file.id),
  })
  const users = await deps.listUsersWithStaticAssets({
    organizationId: options.organizationId ?? null,
    limit: options.limit ?? null,
  })
  const transactionByFileId = buildTransactionByFileIdMap(transactions)

  for (const file of files) {
    const plan = buildFileStorageMigrationPlan({
      file,
      linkedTransaction: transactionByFileId.get(file.id) ?? null,
    })

    if (!plan) {
      continue
    }

    result.processedFiles += 1

    if (dryRun) {
      continue
    }

    try {
      const body = await deps.readLegacyStoredFile({
        organizationId: file.organizationId,
        userId: file.userId,
        storedPath: plan.sourceStoredPath,
        sourceType: "file",
      })

      await deps.putCanonicalObject({
        ownerOrganizationId: plan.organizationId,
        objectKey: plan.targetStoredPath,
        kind: plan.kind,
        contentType: null,
        body,
      })

      if (plan.shouldUpdateDatabase) {
        await deps.updateFilePath(plan.fileId, plan.targetStoredPath, plan.filename)
        result.updatedFiles += 1
      }
    } catch (error) {
      result.errors.push({
        kind: "file",
        id: file.id,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  for (const user of users) {
    for (const field of ["avatar", "businessLogo"] as const) {
      const plan = buildStaticAssetMigrationPlan({
        user,
        field,
      })

      if (!plan) {
        continue
      }

      result.processedStaticAssets += 1

      if (dryRun) {
        continue
      }

      try {
        const body = await deps.readLegacyStoredFile({
          organizationId: plan.organizationId,
          userId: user.id,
          userEmail: user.email,
          storedPath: plan.sourceStoredPath,
          sourceType: "static",
        })

        await deps.putCanonicalObject({
          ownerOrganizationId: plan.organizationId,
          objectKey: plan.targetStoredPath,
          kind: "static",
          contentType: null,
          body,
        })
        await deps.updateUserAsset(plan.userId, plan.field, plan.nextUrl)
        result.updatedStaticAssets += 1
      } catch (error) {
        result.errors.push({
          kind: "static",
          id: `${user.id}:${field}`,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  return result
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  const result = await migrateStorage(options)

  console.info(
    JSON.stringify(
      {
        dryRun: result.dryRun,
        processedFiles: result.processedFiles,
        processedStaticAssets: result.processedStaticAssets,
        updatedFiles: result.updatedFiles,
        updatedStaticAssets: result.updatedStaticAssets,
        errors: result.errors,
      },
      null,
      2
    )
  )

  if (result.errors.length > 0) {
    process.exitCode = 1
  }
}

const entrypoint = process.argv[1]
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  void main()
}
