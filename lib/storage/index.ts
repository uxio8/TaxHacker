import path from "node:path"

import { createLocalStorageProvider } from "./local.ts"
import { createS3StorageProvider } from "./s3.ts"
import type { StorageProvider } from "./types.ts"

let storageProvider: StorageProvider | null = null

function resolveStorageBasePath() {
  return path.resolve(process.env.UPLOAD_PATH || "./uploads")
}

function resolveStorageProviderKind() {
  return (process.env.STORAGE_PROVIDER || "local").trim().toLowerCase()
}

export function createStorageProvider(): StorageProvider {
  if (resolveStorageProviderKind() === "s3") {
    return createS3StorageProvider({
      bucket: process.env.STORAGE_S3_BUCKET || "",
      region: process.env.STORAGE_S3_REGION || "eu-west-1",
      endpoint: process.env.STORAGE_S3_ENDPOINT || null,
      forcePathStyle: ["1", "true", "yes"].includes(
        (process.env.STORAGE_S3_FORCE_PATH_STYLE || "").trim().toLowerCase()
      ),
      accessKeyId: process.env.STORAGE_S3_ACCESS_KEY_ID || null,
      secretAccessKey: process.env.STORAGE_S3_SECRET_ACCESS_KEY || null,
      sessionToken: process.env.STORAGE_S3_SESSION_TOKEN || null,
    })
  }

  return createLocalStorageProvider({
    basePath: resolveStorageBasePath(),
  })
}

export function getStorageProvider(): StorageProvider {
  if (!storageProvider) {
    storageProvider = createStorageProvider()
  }

  return storageProvider
}

export function resetStorageProviderForTests() {
  storageProvider = null
}

export * from "./types.ts"
