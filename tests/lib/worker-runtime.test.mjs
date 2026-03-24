import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import {
  hydrateAttachmentsForDirectProviders,
  materializeAnalysisAttachmentsForPoolCloud,
} from "../../lib/analysis-worker.ts"

test("hydrateAttachmentsForDirectProviders conserva adjuntos ya persistidos en base64", async () => {
  const hydrated = await hydrateAttachmentsForDirectProviders([
    {
      filename: "receipt.webp",
      contentType: "image/webp",
      base64: "dGVzdA==",
      filePath: "",
    },
  ])

  assert.deepEqual(hydrated, [
    {
      filename: "receipt.webp",
      contentType: "image/webp",
      base64: "dGVzdA==",
      filePath: "",
    },
  ])
})

test("materializeAnalysisAttachmentsForPoolCloud crea ficheros temporales desde base64", async () => {
  const workingDirectory = await mkdtemp(path.join(os.tmpdir(), "ledgerflow-worker-runtime-"))

  try {
    const materialized = await materializeAnalysisAttachmentsForPoolCloud(workingDirectory, [
      {
        filename: "invoice-1.webp",
        contentType: "image/webp",
        base64: Buffer.from("image-binary").toString("base64"),
        filePath: "",
      },
    ])

    assert.equal(materialized.length, 1)
    assert.match(materialized[0].filePath, /invoice-1\.webp$/)
    assert.equal((await readFile(materialized[0].filePath)).toString("utf8"), "image-binary")
  } finally {
    await rm(workingDirectory, { recursive: true, force: true })
  }
})
