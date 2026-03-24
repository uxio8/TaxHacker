import type { File, Transaction, User } from "@/prisma/client"
import { access, constants, readdir, stat } from "fs/promises"
import path from "path"
import config from "./config.ts"
import { resolvePathWithinBase, resolveRelativePath } from "./file-security.ts"
import { getStorageProvider } from "./storage/index.ts"
import { buildLegacyStorageUsageDirectories } from "./storage/usage.ts"
import { resolveStoredFileAbsolutePath } from "./storage/paths.ts"
import { buildTransactionFileName } from "./transaction-file-name.ts"

export const FILE_UPLOAD_PATH = path.resolve(process.env.UPLOAD_PATH || "./uploads")
export const FILE_UNSORTED_DIRECTORY_NAME = "unsorted"
export const FILE_PREVIEWS_DIRECTORY_NAME = "previews"
export const FILE_STATIC_DIRECTORY_NAME = "static"
export const FILE_IMPORT_CSV_DIRECTORY_NAME = "csv"

export function getUserUploadsDirectory(user: User) {
  return safePathJoin(FILE_UPLOAD_PATH, user.email)
}

export function getOrganizationStorageDirectory(organizationId: string) {
  return safePathJoin(FILE_UPLOAD_PATH, "organizations", organizationId)
}

export function getStorageUsageDirectories(input: {
  organizationId: string
  legacyUserNamespaces?: Array<string | null | undefined>
}) {
  return buildLegacyStorageUsageDirectories({
    storageBasePath: FILE_UPLOAD_PATH,
    organizationId: input.organizationId,
    legacyUserNamespaces: input.legacyUserNamespaces,
  })
}

export function getStaticDirectory(user: User) {
  return safePathJoin(getUserUploadsDirectory(user), FILE_STATIC_DIRECTORY_NAME)
}

export function getUserPreviewsDirectory(user: User) {
  return safePathJoin(getUserUploadsDirectory(user), FILE_PREVIEWS_DIRECTORY_NAME)
}

export function unsortedFilePath(fileUuid: string, filename: string) {
  const fileExtension = path.extname(filename)
  return resolveRelativePath(FILE_UNSORTED_DIRECTORY_NAME, `${fileUuid}${fileExtension}`)
}

export function previewFilePath(fileUuid: string, page: number) {
  return resolveRelativePath(FILE_PREVIEWS_DIRECTORY_NAME, `${fileUuid}.${page}.webp`)
}

export function getTransactionFileUploadPath(filename: string, transaction: Transaction) {
  return resolveRelativePath(formatFilePath(filename, transaction.issuedAt || new Date()))
}

export function getTransactionStoredFilename(originalFilename: string, transaction: Transaction) {
  return buildTransactionFileName(originalFilename, transaction)
}

export function fullPathForFile(user: User, file: File) {
  const userUploadsDirectory = getUserUploadsDirectory(user)
  return resolveStoredFileAbsolutePath({
    storageBasePath: FILE_UPLOAD_PATH,
    ownerUploadsDirectory: userUploadsDirectory,
    storedPath: file.path,
  })
}

function formatFilePath(filename: string, date: Date, format = "{YYYY}/{MM}/{name}{ext}") {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const ext = path.extname(filename)
  const name = path.basename(filename, ext)

  return format.replace("{YYYY}", String(year)).replace("{MM}", month).replace("{name}", name).replace("{ext}", ext)
}

export function safePathJoin(basePath: string, ...paths: string[]) {
  return resolvePathWithinBase(basePath, ...paths)
}

export async function fileExists(filePath: string) {
  try {
    await access(path.normalize(filePath), constants.F_OK)
    return true
  } catch {
    return false
  }
}

export async function getDirectorySize(directoryPath: string) {
  let totalSize = 0
  async function calculateSize(dir: string) {
    let files
    try {
      files = await readdir(dir, { withFileTypes: true })
    } catch (error) {
      if (isMissingDirectoryError(error)) {
        return
      }

      throw error
    }

    for (const file of files) {
      const fullPath = path.join(dir, file.name)
      if (file.isDirectory()) {
        await calculateSize(fullPath)
      } else if (file.isFile()) {
        const stats = await stat(fullPath)
        totalSize += stats.size
      }
    }
  }
  await calculateSize(directoryPath)
  return totalSize
}

export async function getTenantStorageUsed(input: {
  organizationId: string
  userEmailOrId?: string | null
  legacyUserNamespaces?: Array<string | null | undefined>
}, dependencies: {
  listOrganizationLegacyStorageNamespaces?: (organizationId: string) => Promise<string[]>
  listOrganizationStoredObjects?: (organizationId: string) => Promise<Array<{ objectKey: string; size: number }>>
  getStorageProviderKind?: () => "local" | "s3"
  getDirectorySize?: (directoryPath: string) => Promise<number>
} = {}) {
  const legacyUserNamespaces =
    input.legacyUserNamespaces && input.legacyUserNamespaces.length > 0
      ? input.legacyUserNamespaces
      : await (dependencies.listOrganizationLegacyStorageNamespaces || listOrganizationLegacyStorageNamespaces)(
        input.organizationId
      )
  const storageProviderKind =
    (dependencies.getStorageProviderKind || (() => getStorageProvider().kind))()
  const organizationStoredObjects = await (
    dependencies.listOrganizationStoredObjects
    || (async (organizationId: string) =>
      getStorageProvider().list({
        ownerOrganizationId: organizationId,
        prefix: "",
      }))
  )(input.organizationId)
  const canonicalBytes = Array.from(
    new Map(organizationStoredObjects.map((storedObject) => [storedObject.objectKey, storedObject.size])).values()
  ).reduce((total, size) => total + size, 0)

  if (storageProviderKind !== "local") {
    return canonicalBytes
  }

  const directories = getStorageUsageDirectories({
    organizationId: input.organizationId,
    legacyUserNamespaces: [...legacyUserNamespaces, input.userEmailOrId],
  })
  const measureDirectory = dependencies.getDirectorySize || getDirectorySize
  let legacyBytes = 0

  for (const directory of directories) {
    legacyBytes += await measureDirectory(directory)
  }

  return canonicalBytes + legacyBytes
}

type StorageQuotaUser = Pick<User, "id" | "email"> & {
  storageLimit?: number | null
  defaultOrganizationId?: string | null
  organizationId?: string | null
}

export async function isEnoughStorageToUploadFile(
  user: StorageQuotaUser,
  fileSize: number,
  dependencies: {
    getTenantStorageUsed?: (input: { organizationId: string }) => Promise<number>
    getStorageLimit?: (organizationId: string) => Promise<number>
  } = {}
) {
  const organizationId = user.organizationId || user.defaultOrganizationId || user.id
  const storageLimit = await (
    dependencies.getStorageLimit
    || (async (organizationId: string) => {
      const { getCapabilityLimit } = await import("../models/billing/access.ts")
      return getCapabilityLimit(organizationId, "storage.bytes")
    })
  )(organizationId)

  if (config.selfHosted.isEnabled || storageLimit < 0) {
    return true
  }

  const storageUsed = await (dependencies.getTenantStorageUsed || getTenantStorageUsed)({ organizationId })

  return storageUsed + fileSize <= storageLimit
}

function isMissingDirectoryError(error: unknown) {
  return (
    typeof error === "object"
    && error !== null
    && "code" in error
    && typeof error.code === "string"
    && error.code === "ENOENT"
  )
}

async function listOrganizationLegacyStorageNamespaces(organizationId: string) {
  const { listMembershipUserNamespacesByOrganizationId } = await import("../models/memberships.ts")
  return listMembershipUserNamespacesByOrganizationId(organizationId)
}
