import { mkdir, mkdtemp, readFile, rename, rm, unlink, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { isCanonicalOrganizationObjectKey } from "./keys.ts"
import { resolveStoredFileAbsolutePath } from "./paths.ts"
import { getStorageProvider } from "./index.ts"
import { inferStorageObjectKind, type StorageObjectKind } from "./types.ts"

export type StoredPathLocation = {
  ownerOrganizationId: string
  ownerUploadsDirectory: string
  storedPath: string
}

type PutStoredFileInput = StoredPathLocation & {
  body: Buffer
  contentType: string | null
  kind?: StorageObjectKind
}

function resolveLegacyAbsolutePath(input: StoredPathLocation) {
  return resolveStoredFileAbsolutePath({
    storageBasePath: path.resolve(process.env.UPLOAD_PATH || "./uploads"),
    ownerUploadsDirectory: input.ownerUploadsDirectory,
    storedPath: input.storedPath,
  })
}

export async function storedPathExists(input: StoredPathLocation) {
  if (!isCanonicalOrganizationObjectKey(input.storedPath)) {
    try {
      await readFile(resolveLegacyAbsolutePath(input))
      return true
    } catch (error) {
      if (isMissingFileError(error)) {
        return false
      }

      throw error
    }
  }

  return getStorageProvider().exists({
    ownerOrganizationId: input.ownerOrganizationId,
    objectKey: input.storedPath,
  })
}

export async function putStoredFileBuffer(input: PutStoredFileInput) {
  if (!isCanonicalOrganizationObjectKey(input.storedPath)) {
    const absolutePath = resolveLegacyAbsolutePath(input)
    await mkdir(path.dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, input.body)
    return absolutePath
  }

  await getStorageProvider().put({
    ownerOrganizationId: input.ownerOrganizationId,
    objectKey: input.storedPath,
    kind: input.kind ?? inferStorageObjectKind(input.storedPath),
    contentType: input.contentType,
    body: input.body,
  })

  return input.storedPath
}

export async function readStoredFileBuffer(input: StoredPathLocation) {
  if (!isCanonicalOrganizationObjectKey(input.storedPath)) {
    return readFile(resolveLegacyAbsolutePath(input))
  }

  const object = await getStorageProvider().get({
    ownerOrganizationId: input.ownerOrganizationId,
    objectKey: input.storedPath,
  })

  if (!object) {
    throw new Error(`Storage object not found: ${input.storedPath}`)
  }

  return object.body
}

export async function deleteStoredFile(input: StoredPathLocation) {
  if (!isCanonicalOrganizationObjectKey(input.storedPath)) {
    try {
      await unlink(resolveLegacyAbsolutePath(input))
      return true
    } catch (error) {
      if (isMissingFileError(error)) {
        return false
      }

      throw error
    }
  }

  return getStorageProvider().delete({
    ownerOrganizationId: input.ownerOrganizationId,
    objectKey: input.storedPath,
  })
}

export async function moveStoredFile(
  input: StoredPathLocation & {
    nextStoredPath: string
  }
) {
  if (
    isCanonicalOrganizationObjectKey(input.storedPath)
    && isCanonicalOrganizationObjectKey(input.nextStoredPath)
  ) {
    const moved = await getStorageProvider().move({
      ownerOrganizationId: input.ownerOrganizationId,
      fromObjectKey: input.storedPath,
      toObjectKey: input.nextStoredPath,
    })

    return moved !== null
  }

  const fromAbsolutePath = resolveLegacyAbsolutePath(input)
  const toAbsolutePath = resolveStoredFileAbsolutePath({
    storageBasePath: path.resolve(process.env.UPLOAD_PATH || "./uploads"),
    ownerUploadsDirectory: input.ownerUploadsDirectory,
    storedPath: input.nextStoredPath,
  })
  await mkdir(path.dirname(toAbsolutePath), { recursive: true })
  await rename(fromAbsolutePath, toAbsolutePath)
  return true
}

export async function materializeStoredFileToLocalPath(input: StoredPathLocation) {
  if (!isCanonicalOrganizationObjectKey(input.storedPath)) {
    return {
      path: resolveLegacyAbsolutePath(input),
      cleanup: async () => {},
    }
  }

  const provider = getStorageProvider()

  if (provider.kind === "local") {
    return {
      path: resolveStoredFileAbsolutePath({
        storageBasePath: path.resolve(process.env.UPLOAD_PATH || "./uploads"),
        ownerUploadsDirectory: input.ownerUploadsDirectory,
        storedPath: input.storedPath,
      }),
      cleanup: async () => {},
    }
  }

  const object = await provider.get({
    ownerOrganizationId: input.ownerOrganizationId,
    objectKey: input.storedPath,
  })

  if (!object) {
    throw new Error(`Storage object not found: ${input.storedPath}`)
  }

  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "ledgerflow-storage-"))
  const tempPath = path.join(tempDirectory, path.basename(input.storedPath))
  await writeFile(tempPath, object.body)

  return {
    path: tempPath,
    cleanup: async () => {
      await rm(tempDirectory, { recursive: true, force: true })
    },
  }
}

function isMissingFileError(error: unknown) {
  return (
    typeof error === "object"
    && error !== null
    && "code" in error
    && typeof error.code === "string"
    && error.code === "ENOENT"
  )
}
