import fs from "node:fs/promises"

import JSZip from "jszip"

import { normalizeBackupFilePath } from "../../../../lib/file-security.ts"
import { getStorageUsageDirectories, getUserUploadsDirectory } from "../../../../lib/files.ts"
import { getStorageProvider } from "../../../../lib/storage/index.ts"
import { putStoredFileBuffer, readStoredFileBuffer } from "../../../../lib/storage/runtime.ts"
import { listMembershipUserNamespacesByOrganizationId } from "../../../../models/memberships.ts"
import { getUserById } from "../../../../models/users.ts"

export type BackupStoredFileRecord = {
  id: string
  userId: string
  organizationId: string
  path: string
  mimetype: string
}

type BackupOwner = {
  id: string
  email: string
}

type BackupStorageDependencies = {
  getUserById?: (userId: string) => Promise<BackupOwner | null>
  getUserUploadsDirectory?: (user: BackupOwner) => string
  readStoredFileBuffer?: (input: {
    ownerOrganizationId: string
    ownerUploadsDirectory: string
    storedPath: string
  }) => Promise<Buffer>
  putStoredFileBuffer?: (input: {
    ownerOrganizationId: string
    ownerUploadsDirectory: string
    storedPath: string
    body: Buffer
    contentType: string | null
  }) => Promise<unknown>
  getStorageProvider?: typeof getStorageProvider
  listLegacyUserNamespaces?: (organizationId: string) => Promise<string[]>
  removeDirectory?: (directoryPath: string) => Promise<void>
}

function resolveBackupStorageDependencies(
  dependencies: BackupStorageDependencies = {}
): Required<BackupStorageDependencies> {
  return {
    getUserById,
    getUserUploadsDirectory: (user) => getUserUploadsDirectory(user as never),
    readStoredFileBuffer,
    putStoredFileBuffer,
    getStorageProvider,
    listLegacyUserNamespaces: listMembershipUserNamespacesByOrganizationId,
    removeDirectory: async (directoryPath: string) => {
      await fs.rm(directoryPath, { recursive: true, force: true })
    },
    ...dependencies,
  }
}

export function toBackupZipPath(storedPath: string) {
  return `data/uploads/${normalizeBackupFilePath(storedPath).replaceAll("\\", "/")}`
}

export async function buildBackupStoredEntries(
  files: BackupStoredFileRecord[],
  dependencies: BackupStorageDependencies = {}
) {
  const deps = resolveBackupStorageDependencies(dependencies)
  const ownerCache = new Map<string, BackupOwner | null>()
  const entries: Array<{ file: BackupStoredFileRecord; zipPath: string; body: Buffer }> = []

  for (const file of files) {
    let owner = ownerCache.get(file.userId) ?? null

    if (!ownerCache.has(file.userId)) {
      owner = await deps.getUserById(file.userId)
      ownerCache.set(file.userId, owner)
    }

    if (!owner) {
      continue
    }

    const body = await deps.readStoredFileBuffer({
      ownerOrganizationId: file.organizationId,
      ownerUploadsDirectory: deps.getUserUploadsDirectory(owner),
      storedPath: file.path,
    })

    entries.push({
      file,
      zipPath: toBackupZipPath(file.path),
      body,
    })
  }

  return entries
}

export async function restoreBackupStoredFilesFromZip(
  files: BackupStoredFileRecord[],
  zip: JSZip,
  currentUser: BackupOwner,
  dependencies: BackupStorageDependencies = {}
) {
  const deps = resolveBackupStorageDependencies(dependencies)
  const ownerUploadsDirectory = deps.getUserUploadsDirectory(currentUser)
  let restoredFilesCount = 0

  for (const file of files) {
    const zipFile = zip.file(toBackupZipPath(file.path))

    if (!zipFile) {
      continue
    }

    const fileContents = await zipFile.async("nodebuffer")
    const normalizedStoredPath = normalizeBackupFilePath(file.path)

    await deps.putStoredFileBuffer({
      ownerOrganizationId: file.organizationId,
      ownerUploadsDirectory,
      storedPath: normalizedStoredPath,
      body: fileContents,
      contentType: file.mimetype || null,
    })

    restoredFilesCount++
  }

  return restoredFilesCount
}

export async function clearTenantStoredFiles(
  input: {
    organizationId: string
    currentUser: BackupOwner
  },
  dependencies: BackupStorageDependencies = {}
) {
  const deps = resolveBackupStorageDependencies(dependencies)
  const provider = deps.getStorageProvider()
  const storedObjects = await provider.list({
    ownerOrganizationId: input.organizationId,
    prefix: "",
  })

  for (const storedObject of storedObjects) {
    await provider.delete({
      ownerOrganizationId: input.organizationId,
      objectKey: storedObject.objectKey,
    })
  }

  if (provider.kind !== "local") {
    return
  }

  const legacyUserNamespaces = await deps.listLegacyUserNamespaces(input.organizationId)
  const legacyDirectories = getStorageUsageDirectories({
    organizationId: input.organizationId,
    legacyUserNamespaces: [
      ...legacyUserNamespaces,
      input.currentUser.id,
      input.currentUser.email,
    ],
  })

  for (const directoryPath of legacyDirectories) {
    await deps.removeDirectory(directoryPath)
  }
}
