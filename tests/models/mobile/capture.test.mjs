import assert from "node:assert/strict"
import test from "node:test"

import { MOBILE_ITEM_STATE, captureMobileFiles } from "../../../models/mobile/capture.ts"
import { MOBILE_REASON_CODE } from "../../../models/mobile/types.ts"

function createUser(overrides = {}) {
  return {
    id: "user-1",
    organizationId: "org-1",
    email: "ledgerflow@example.com",
    storageLimit: 1_000_000,
    storageUsed: 0,
    ...overrides,
  }
}

function createDependencies(overrides = {}) {
  const calls = {
    createFileRecord: [],
    updateFileRecord: [],
    createAnalysisJob: [],
    ensureWorkerAvailable: [],
    writeStoredFile: [],
    updateUserStorage: [],
  }

  return {
    calls,
    deps: {
      now: () => new Date("2026-03-22T10:00:00.000Z"),
      createId: () => "file-1",
      canAcceptMobileMimeType: (mimeType) => mimeType === "application/pdf" || mimeType.startsWith("image/"),
      hasAvailableStorage: () => true,
      getUserUploadsDirectory: () => "/tmp/ledgerflow/user-1",
      resolveUnsortedFilePath: (fileId, filename) => `unsorted/${fileId}-${filename}`,
      writeStoredFile: async ({ storedPath, buffer }) => {
        calls.writeStoredFile.push({ storedPath, size: buffer.length })
      },
      createFileRecord: async (_userId, data) => {
        calls.createFileRecord.push(data)

        return {
          id: data.id,
          filename: data.filename,
          mimetype: data.mimetype,
          metadata: data.metadata,
          cachedParseResult: null,
          createdAt: new Date("2026-03-22T10:00:00.000Z"),
        }
      },
      updateFileRecord: async (fileId, _userId, data) => {
        calls.updateFileRecord.push({ fileId, data })
      },
      updateUserStorage: async (user, storageUsed) => {
        calls.updateUserStorage.push({ userId: user.id, organizationId: user.organizationId, storageUsed })
      },
      calculateStorageUsed: async () => 128,
      getAnalysisCapability: async () => ({
        supported: true,
        llmConfigured: true,
        workerAvailable: true,
      }),
      createAnalysisJob: async (_user, fileRecord) => {
        calls.createAnalysisJob.push(fileRecord.id)

        return {
          id: "job-1",
          status: "queued",
        }
      },
      ensureWorkerAvailable: async (jobId) => {
        calls.ensureWorkerAvailable.push(jobId)
        return true
      },
      ...overrides,
    },
  }
}

test("captureMobileFiles rechaza tipos no soportados antes de persistir nada", async () => {
  const { deps, calls } = createDependencies()

  const result = await captureMobileFiles(
    {
      user: createUser(),
      files: [new File(["hola"], "nota.txt", { type: "text/plain" })],
    },
    deps
  )

  assert.equal(result.ok, false)
  assert.equal(result.status, 400)
  assert.equal(result.reasonCode, MOBILE_REASON_CODE.UNSUPPORTED_TYPE)
  assert.equal(calls.createFileRecord.length, 0)
  assert.equal(calls.writeStoredFile.length, 0)
})

test("captureMobileFiles devuelve error explicito y no crea items si no hay almacenamiento disponible", async () => {
  const { deps, calls } = createDependencies({
    hasAvailableStorage: () => false,
  })

  const result = await captureMobileFiles(
    {
      user: createUser({ storageLimit: 5, storageUsed: 5 }),
      files: [new File(["123456"], "factura.pdf", { type: "application/pdf" })],
    },
    deps
  )

  assert.equal(result.ok, false)
  assert.equal(result.status, 507)
  assert.equal(result.reasonCode, MOBILE_REASON_CODE.STORAGE_UNAVAILABLE)
  assert.equal(calls.createFileRecord.length, 0)
  assert.equal(calls.writeStoredFile.length, 0)
})

test("captureMobileFiles crea el item y lo difiere a desktop cuando falta configuracion LLM", async () => {
  const { deps, calls } = createDependencies({
    getAnalysisCapability: async () => ({
      supported: true,
      llmConfigured: false,
      workerAvailable: true,
    }),
  })

  const result = await captureMobileFiles(
    {
      user: createUser(),
      files: [new File(["pdf"], "factura.pdf", { type: "application/pdf" })],
    },
    deps
  )

  assert.equal(result.ok, true)
  assert.equal(result.items.length, 1)
  assert.equal(result.items[0]?.state, MOBILE_ITEM_STATE.DEFERRED_TO_DESKTOP)
  assert.equal(result.items[0]?.reasonCode, MOBILE_REASON_CODE.LLM_NOT_CONFIGURED)
  assert.equal(result.items[0]?.analysisJobId, null)
  assert.equal(calls.createFileRecord.length, 1)
  assert.equal(calls.createAnalysisJob.length, 0)
  assert.equal(calls.createFileRecord[0]?.metadata.mobileTriage.disposition, "deferred")
  assert.equal(calls.createFileRecord[0]?.metadata.mobileTriage.reasonCode, MOBILE_REASON_CODE.LLM_NOT_CONFIGURED)
})

test("captureMobileFiles crea el item y lo difiere a desktop cuando el worker no esta disponible", async () => {
  const { deps, calls } = createDependencies({
    getAnalysisCapability: async () => ({
      supported: true,
      llmConfigured: true,
      workerAvailable: false,
    }),
  })

  const result = await captureMobileFiles(
    {
      user: createUser(),
      files: [new File(["pdf"], "factura.pdf", { type: "application/pdf" })],
    },
    deps
  )

  assert.equal(result.ok, true)
  assert.equal(result.items.length, 1)
  assert.equal(result.items[0]?.state, MOBILE_ITEM_STATE.DEFERRED_TO_DESKTOP)
  assert.equal(result.items[0]?.reasonCode, MOBILE_REASON_CODE.WORKER_UNAVAILABLE)
  assert.equal(result.items[0]?.analysisJobId, null)
  assert.equal(calls.createFileRecord.length, 1)
  assert.equal(calls.createAnalysisJob.length, 0)
  assert.equal(calls.createFileRecord[0]?.metadata.mobileTriage.disposition, "deferred")
  assert.equal(calls.createFileRecord[0]?.metadata.mobileTriage.reasonCode, MOBILE_REASON_CODE.WORKER_UNAVAILABLE)
})

test("captureMobileFiles persiste analysis_failed cuando falla el enqueue inicial", async () => {
  const { deps, calls } = createDependencies({
    createAnalysisJob: async () => {
      throw new Error("provider timeout")
    },
  })

  const result = await captureMobileFiles(
    {
      user: createUser(),
      files: [new File(["pdf"], "factura.pdf", { type: "application/pdf" })],
    },
    deps
  )

  assert.equal(result.ok, true)
  assert.equal(result.items.length, 1)
  assert.equal(result.items[0]?.state, MOBILE_ITEM_STATE.ERROR)
  assert.equal(result.items[0]?.reasonCode, MOBILE_REASON_CODE.ANALYSIS_FAILED)
  assert.equal(calls.updateFileRecord.length, 1)
  assert.deepEqual(calls.updateFileRecord[0], {
    fileId: "file-1",
    data: {
      metadata: {
        mobileTriage: {
          source: "mobile_capture",
          disposition: "deferred",
          reasonCode: MOBILE_REASON_CODE.ANALYSIS_FAILED,
          lastMobileActionAt: "2026-03-22T10:00:00.000Z",
        },
      },
    },
  })
})

test("captureMobileFiles crea el item y encola analisis cuando hay capacidad operativa", async () => {
  const { deps, calls } = createDependencies()

  const result = await captureMobileFiles(
    {
      user: createUser(),
      files: [new File(["pdf"], "factura.pdf", { type: "application/pdf" })],
    },
    deps
  )

  assert.equal(result.ok, true)
  assert.equal(result.items.length, 1)
  assert.equal(result.items[0]?.state, MOBILE_ITEM_STATE.ANALYZING)
  assert.equal(result.items[0]?.reasonCode, null)
  assert.equal(result.items[0]?.analysisJobId, "job-1")
  assert.equal(calls.createFileRecord.length, 1)
  assert.deepEqual(calls.createAnalysisJob, ["file-1"])
  assert.deepEqual(calls.ensureWorkerAvailable, ["job-1"])
  assert.equal(calls.createFileRecord[0]?.metadata.mobileTriage.source, "mobile_capture")
  assert.equal(calls.createFileRecord[0]?.metadata.mobileTriage.disposition, "pending")
  assert.equal(
    calls.createFileRecord[0]?.metadata.mobileTriage.lastMobileActionAt,
    "2026-03-22T10:00:00.000Z"
  )
})
