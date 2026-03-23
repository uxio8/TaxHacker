import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"

import { resolvePathWithinBase, resolveRelativePath } from "../file-security.ts"
import type {
  StorageCopyInput,
  StorageDownloadHandle,
  StorageGetResult,
  StorageListInput,
  StorageObject,
  StorageObjectKind,
  StorageObjectRef,
  StorageProvider,
  StoragePutInput,
} from "./types.ts"
import { assertObjectKeyBelongsToOrganization, inferStorageObjectKind } from "./types.ts"

type LocalStorageProviderOptions = {
  basePath: string
}

function toBuffer(body: StoragePutInput["body"]) {
  if (Buffer.isBuffer(body)) {
    return body
  }

  if (typeof body === "string") {
    return Buffer.from(body)
  }

  return Buffer.from(body)
}

function normalizeObjectKey(ownerOrganizationId: string, objectKey: string) {
  const normalizedObjectKey = resolveRelativePath(objectKey)
  assertObjectKeyBelongsToOrganization(ownerOrganizationId, normalizedObjectKey)
  return normalizedObjectKey
}

async function ensureParentDirectory(absolutePath: string) {
  await mkdir(path.dirname(absolutePath), { recursive: true })
}

function buildStoredObject(
  ownerOrganizationId: string,
  objectKey: string,
  size: number,
  kind?: StorageObjectKind,
  contentType: string | null = inferContentTypeFromObjectKey(objectKey)
): StorageObject {
  return {
    ownerOrganizationId,
    objectKey,
    kind: kind ?? inferStorageObjectKind(objectKey),
    contentType,
    size,
  }
}

function inferContentTypeFromObjectKey(objectKey: string) {
  const extension = path.extname(objectKey).toLowerCase()

  switch (extension) {
    case ".pdf":
      return "application/pdf"
    case ".webp":
      return "image/webp"
    case ".jpg":
    case ".jpeg":
      return "image/jpeg"
    case ".png":
      return "image/png"
    default:
      return null
  }
}

async function listFilesRecursively(directoryPath: string): Promise<string[]> {
  const { readdir } = await import("node:fs/promises")
  const entries = await readdir(directoryPath, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const absolutePath = path.join(directoryPath, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursively(absolutePath)))
      continue
    }

    if (entry.isFile()) {
      files.push(absolutePath)
    }
  }

  return files
}

export function createLocalStorageProvider(options: LocalStorageProviderOptions): StorageProvider {
  const normalizedBasePath = path.resolve(options.basePath)

  function toAbsolutePath(ownerOrganizationId: string, objectKey: string) {
    const normalizedObjectKey = normalizeObjectKey(ownerOrganizationId, objectKey)
    return {
      objectKey: normalizedObjectKey,
      absolutePath: resolvePathWithinBase(normalizedBasePath, normalizedObjectKey),
    }
  }

  async function get(input: StorageObjectRef): Promise<StorageGetResult | null> {
    const { objectKey, absolutePath } = toAbsolutePath(input.ownerOrganizationId, input.objectKey)

    try {
      const [body, fileStats] = await Promise.all([readFile(absolutePath), stat(absolutePath)])
      return {
        ...buildStoredObject(input.ownerOrganizationId, objectKey, fileStats.size),
        body,
      }
    } catch (error) {
      if (isMissingFileError(error)) {
        return null
      }

      throw error
    }
  }

  async function deleteObject(input: StorageObjectRef) {
    const { absolutePath } = toAbsolutePath(input.ownerOrganizationId, input.objectKey)

    try {
      await rm(absolutePath, { force: true })
      return true
    } catch (error) {
      if (isMissingFileError(error)) {
        return false
      }

      throw error
    }
  }

  async function copyOrMove(input: StorageCopyInput, mode: "copy" | "move") {
    const from = toAbsolutePath(input.ownerOrganizationId, input.fromObjectKey)
    const to = toAbsolutePath(input.ownerOrganizationId, input.toObjectKey)

    try {
      const sourceStats = await stat(from.absolutePath)
      await ensureParentDirectory(to.absolutePath)

      if (mode === "copy") {
        await copyFile(from.absolutePath, to.absolutePath)
      } else {
        await rename(from.absolutePath, to.absolutePath)
      }

      return buildStoredObject(input.ownerOrganizationId, to.objectKey, sourceStats.size)
    } catch (error) {
      if (isMissingFileError(error)) {
        return null
      }

      throw error
    }
  }

  return {
    kind: "local",
    async put(input) {
      const { objectKey, absolutePath } = toAbsolutePath(input.ownerOrganizationId, input.objectKey)
      const body = toBuffer(input.body)

      await ensureParentDirectory(absolutePath)
      await writeFile(absolutePath, body)

      return buildStoredObject(
        input.ownerOrganizationId,
        objectKey,
        body.byteLength,
        input.kind,
        input.contentType
      )
    },
    get,
    async exists(input) {
      const { absolutePath } = toAbsolutePath(input.ownerOrganizationId, input.objectKey)

      try {
        await stat(absolutePath)
        return true
      } catch (error) {
        if (isMissingFileError(error)) {
          return false
        }

        throw error
      }
    },
    async delete(input) {
      return deleteObject(input)
    },
    async copy(input) {
      return copyOrMove(input, "copy")
    },
    async move(input) {
      return copyOrMove(input, "move")
    },
    async list(input: StorageListInput) {
      const prefix = input.prefix.replace(/^\/+|\/+$/g, "")
      const basePrefix = prefix
        ? `${path.posix.join(`organizations/${input.ownerOrganizationId}`, prefix)}`
        : `organizations/${input.ownerOrganizationId}`
      const absoluteDirectory = resolvePathWithinBase(normalizedBasePath, basePrefix)

      try {
        const files = await listFilesRecursively(absoluteDirectory)
        const items = await Promise.all(
          files.map(async (absolutePath) => {
            const relativeObjectKey = path.relative(normalizedBasePath, absolutePath).replaceAll(path.sep, "/")
            const fileStats = await stat(absolutePath)

            return buildStoredObject(input.ownerOrganizationId, relativeObjectKey, fileStats.size)
          })
        )

        return items.sort((left, right) => left.objectKey.localeCompare(right.objectKey))
      } catch (error) {
        if (isMissingFileError(error)) {
          return []
        }

        throw error
      }
    },
    async openDownload(
      input: StorageObjectRef & {
        disposition: "inline" | "attachment"
      }
    ): Promise<StorageDownloadHandle | null> {
      const { objectKey, absolutePath } = toAbsolutePath(input.ownerOrganizationId, input.objectKey)

      try {
        await stat(absolutePath)
        return {
          kind: "path",
          ownerOrganizationId: input.ownerOrganizationId,
          objectKey,
          absolutePath,
          disposition: input.disposition,
        }
      } catch (error) {
        if (isMissingFileError(error)) {
          return null
        }

        throw error
      }
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
