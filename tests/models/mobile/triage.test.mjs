import assert from "node:assert/strict"
import test from "node:test"

import {
  MOBILE_CONFIDENCE,
  MOBILE_REASON_CODE,
  buildReviewedFileUpdate,
  getMobileConfidence,
  getMobileSystemStatus,
  readMobileTriageMetadata,
} from "../../../lib/mobile-triage.ts"

test("getMobileConfidence devuelve high si existen merchant, issuedAt, total e invoice_number", () => {
  assert.equal(
    getMobileConfidence({
      merchant: "Proveedor demo",
      issuedAt: "2026-03-22",
      total: 1999,
      invoice_number: "F-2026-001",
    }),
    MOBILE_CONFIDENCE.HIGH
  )
})

test("readMobileTriageMetadata normaliza deferred_to_desktop como continuidad diferida", () => {
  assert.deepEqual(
    readMobileTriageMetadata({
      mobileTriage: {
        source: "mobile_capture",
        disposition: "deferred_to_desktop",
        reasonCode: MOBILE_REASON_CODE.USER_DEFERRED,
        lastMobileActionAt: "2026-03-22T10:00:00.000Z",
      },
    }),
    {
      source: "mobile_capture",
      disposition: "deferred",
      reasonCode: MOBILE_REASON_CODE.USER_DEFERRED,
      lastMobileActionAt: "2026-03-22T10:00:00.000Z",
    }
  )
})

test("buildReviewedFileUpdate elimina mobileTriage al cerrar la revision movil", () => {
  assert.deepEqual(
    buildReviewedFileUpdate({
      filename: "factura-final.pdf",
      path: "processed/factura-final.pdf",
      metadata: {
        documentType: "receipt",
        mobileTriage: {
          source: "mobile_capture",
          disposition: "pending",
          lastMobileActionAt: "2026-03-22T10:00:00.000Z",
        },
      },
    }),
    {
      filename: "factura-final.pdf",
      path: "processed/factura-final.pdf",
      isReviewed: true,
      metadata: {
        documentType: "receipt",
      },
    }
  )
})

test("getMobileSystemStatus usa el heartbeat real para detectar worker no disponible", async () => {
  const result = await getMobileSystemStatus(
    {
      storageAvailable: true,
      llmConfigured: true,
    },
    {
      readAnalysisWorkerHeartbeat: async () => ({
        pid: 42,
        startedAt: "2026-03-22T10:00:00.000Z",
        updatedAt: "2026-03-22T09:59:00.000Z",
        state: "idle",
        currentJobId: null,
      }),
      isHeartbeatFresh: () => false,
      isProcessAlive: () => true,
    }
  )

  assert.deepEqual(result, {
    llmConfigured: true,
    workerAvailable: false,
    storageAvailable: true,
    blockingReasonCode: MOBILE_REASON_CODE.WORKER_UNAVAILABLE,
  })
})

test("getMobileSystemStatus prioriza storage_unavailable cuando no queda espacio", async () => {
  const result = await getMobileSystemStatus(
    {
      storageAvailable: false,
      llmConfigured: true,
    },
    {
      readAnalysisWorkerHeartbeat: async () => ({
        pid: 42,
        startedAt: "2026-03-22T10:00:00.000Z",
        updatedAt: "2026-03-22T10:00:00.000Z",
        state: "idle",
        currentJobId: null,
      }),
      isHeartbeatFresh: () => true,
      isProcessAlive: () => true,
    }
  )

  assert.deepEqual(result, {
    llmConfigured: true,
    workerAvailable: true,
    storageAvailable: false,
    blockingReasonCode: MOBILE_REASON_CODE.STORAGE_UNAVAILABLE,
  })
})
