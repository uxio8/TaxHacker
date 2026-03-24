import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import { createLocalStorageProvider } from "../../../lib/storage/local.ts"

async function withTempDir(run) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "ledgerflow-storage-"))

  try {
    await run(tempDir)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

test("local storage provider guarda, lee, abre y borra objetos dentro del tenant", async () => {
  await withTempDir(async (basePath) => {
    const provider = createLocalStorageProvider({ basePath })
    const objectKey = "organizations/org-1/uploads/unsorted/file-1.pdf"

    const stored = await provider.put({
      ownerOrganizationId: "org-1",
      objectKey,
      kind: "unsorted",
      contentType: "application/pdf",
      body: Buffer.from("pdf-content"),
    })

    assert.equal(stored.objectKey, objectKey)
    assert.equal(stored.ownerOrganizationId, "org-1")
    assert.equal(stored.contentType, "application/pdf")
    assert.equal(stored.size, 11)

    const downloaded = await provider.get({
      ownerOrganizationId: "org-1",
      objectKey,
    })

    assert.ok(downloaded)
    assert.equal(downloaded?.objectKey, objectKey)
    assert.equal(downloaded?.contentType, "application/pdf")
    assert.equal(downloaded?.body.toString("utf8"), "pdf-content")

    const handle = await provider.openDownload({
      ownerOrganizationId: "org-1",
      objectKey,
      disposition: "attachment",
    })

    assert.ok(handle)
    assert.equal(handle?.kind, "path")
    assert.match(handle?.absolutePath ?? "", /organizations\/org-1\/uploads\/unsorted\/file-1\.pdf$/)

    const deleted = await provider.delete({
      ownerOrganizationId: "org-1",
      objectKey,
    })

    assert.equal(deleted, true)

    const afterDelete = await provider.get({
      ownerOrganizationId: "org-1",
      objectKey,
    })

    assert.equal(afterDelete, null)
  })
})

test("local storage provider copia, mueve y lista por prefijo dentro del tenant", async () => {
  await withTempDir(async (basePath) => {
    const provider = createLocalStorageProvider({ basePath })
    const sourceKey = "organizations/org-1/uploads/transactions/file-1/2026/03/original.pdf"
    const copiedKey = "organizations/org-1/uploads/transactions/file-1/2026/03/copied.pdf"
    const movedKey = "organizations/org-1/derived/previews/file-1/1.webp"

    await provider.put({
      ownerOrganizationId: "org-1",
      objectKey: sourceKey,
      kind: "transaction",
      contentType: "application/pdf",
      body: Buffer.from("content"),
    })

    const copied = await provider.copy({
      ownerOrganizationId: "org-1",
      fromObjectKey: sourceKey,
      toObjectKey: copiedKey,
    })

    assert.ok(copied)
    assert.equal(copied?.objectKey, copiedKey)

    const moved = await provider.move({
      ownerOrganizationId: "org-1",
      fromObjectKey: copiedKey,
      toObjectKey: movedKey,
    })

    assert.ok(moved)
    assert.equal(moved?.objectKey, movedKey)
    assert.equal(moved?.kind, "preview")

    const uploads = await provider.list({
      ownerOrganizationId: "org-1",
      prefix: "uploads/transactions",
    })

    assert.deepEqual(
      uploads.map((item) => item.objectKey),
      [sourceKey]
    )

    const previews = await provider.list({
      ownerOrganizationId: "org-1",
      prefix: "derived/previews",
    })

    assert.deepEqual(
      previews.map((item) => item.objectKey),
      [movedKey]
    )
  })
})

test("local storage provider bloquea claves fuera del namespace de la organización", async () => {
  await withTempDir(async (basePath) => {
    const provider = createLocalStorageProvider({ basePath })

    await assert.rejects(
      provider.put({
        ownerOrganizationId: "org-1",
        objectKey: "organizations/org-2/uploads/unsorted/file-1.pdf",
        kind: "unsorted",
        contentType: "application/pdf",
        body: Buffer.from("pdf-content"),
      }),
      /organization namespace/
    )
  })
})
