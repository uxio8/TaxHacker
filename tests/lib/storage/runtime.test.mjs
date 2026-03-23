import assert from "node:assert/strict"
import { access, mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import { resolveStoredFileAbsolutePath } from "../../../lib/storage/paths.ts"
import {
  deleteStoredFile,
  materializeStoredFileToLocalPath,
  moveStoredFile,
  putStoredFileBuffer,
  readStoredFileBuffer,
  storedPathExists,
} from "../../../lib/storage/runtime.ts"
import { resetStorageProviderForTests } from "../../../lib/storage/index.ts"

async function withStorageEnv(run) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "ledgerflow-storage-runtime-"))
  const previousUploadPath = process.env.UPLOAD_PATH
  const previousStorageProvider = process.env.STORAGE_PROVIDER

  process.env.UPLOAD_PATH = tempDir
  process.env.STORAGE_PROVIDER = "local"
  resetStorageProviderForTests()

  try {
    await run(tempDir)
  } finally {
    if (previousUploadPath === undefined) {
      delete process.env.UPLOAD_PATH
    } else {
      process.env.UPLOAD_PATH = previousUploadPath
    }

    if (previousStorageProvider === undefined) {
      delete process.env.STORAGE_PROVIDER
    } else {
      process.env.STORAGE_PROVIDER = previousStorageProvider
    }

    resetStorageProviderForTests()
    await rm(tempDir, { recursive: true, force: true })
  }
}

test("storage runtime resuelve claves canónicas con provider local", async () => {
  await withStorageEnv(async (storageBasePath) => {
    const ownerUploadsDirectory = path.join(storageBasePath, "users", "user-1")
    const originalKey = "organizations/org-1/uploads/unsorted/file-1.pdf"
    const movedKey = "organizations/org-1/uploads/transactions/file-1/2026/03/original.pdf"

    await putStoredFileBuffer({
      ownerOrganizationId: "org-1",
      ownerUploadsDirectory,
      storedPath: originalKey,
      contentType: "application/pdf",
      kind: "unsorted",
      body: Buffer.from("pdf-content"),
    })

    const originalAbsolutePath = resolveStoredFileAbsolutePath({
      storageBasePath,
      ownerUploadsDirectory,
      storedPath: originalKey,
    })

    assert.equal(await storedPathExists({
      ownerOrganizationId: "org-1",
      ownerUploadsDirectory,
      storedPath: originalKey,
    }), true)
    assert.equal((await readFile(originalAbsolutePath)).toString("utf8"), "pdf-content")
    assert.equal(
      (await readStoredFileBuffer({
        ownerOrganizationId: "org-1",
        ownerUploadsDirectory,
        storedPath: originalKey,
      })).toString("utf8"),
      "pdf-content"
    )

    await moveStoredFile({
      ownerOrganizationId: "org-1",
      ownerUploadsDirectory,
      storedPath: originalKey,
      nextStoredPath: movedKey,
    })

    assert.equal(await storedPathExists({
      ownerOrganizationId: "org-1",
      ownerUploadsDirectory,
      storedPath: originalKey,
    }), false)
    assert.equal(await storedPathExists({
      ownerOrganizationId: "org-1",
      ownerUploadsDirectory,
      storedPath: movedKey,
    }), true)

    const materialized = await materializeStoredFileToLocalPath({
      ownerOrganizationId: "org-1",
      ownerUploadsDirectory,
      storedPath: movedKey,
    })

    assert.equal((await readFile(materialized.path)).toString("utf8"), "pdf-content")
    await materialized.cleanup()
    assert.equal((await readFile(materialized.path)).toString("utf8"), "pdf-content")
  })
})

test("storage runtime mantiene compatibilidad con rutas legacy", async () => {
  await withStorageEnv(async (storageBasePath) => {
    const ownerUploadsDirectory = path.join(storageBasePath, "users", "user-1")
    const originalPath = "uploads/unsorted/file-1.pdf"
    const movedPath = "uploads/transactions/file-1/original.pdf"

    await putStoredFileBuffer({
      ownerOrganizationId: "org-1",
      ownerUploadsDirectory,
      storedPath: originalPath,
      contentType: "application/pdf",
      body: Buffer.from("legacy-content"),
    })

    assert.equal(await storedPathExists({
      ownerOrganizationId: "org-1",
      ownerUploadsDirectory,
      storedPath: originalPath,
    }), true)

    await moveStoredFile({
      ownerOrganizationId: "org-1",
      ownerUploadsDirectory,
      storedPath: originalPath,
      nextStoredPath: movedPath,
    })

    const materialized = await materializeStoredFileToLocalPath({
      ownerOrganizationId: "org-1",
      ownerUploadsDirectory,
      storedPath: movedPath,
    })

    assert.equal((await readFile(materialized.path)).toString("utf8"), "legacy-content")
    await deleteStoredFile({
      ownerOrganizationId: "org-1",
      ownerUploadsDirectory,
      storedPath: movedPath,
    })

    await assert.rejects(access(materialized.path))
  })
})
