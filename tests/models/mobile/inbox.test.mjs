import assert from "node:assert/strict"
import test from "node:test"

import {
  MOBILE_ITEM_STATE,
  MOBILE_REASON_CODE,
  createMobileInboxResponse,
  getMobileInbox,
} from "../../../models/mobile/inbox.ts"
import { buildReviewedFileUpdate } from "../../../lib/mobile-triage.ts"

function createUser(overrides = {}) {
  return {
    id: "user-1",
    organizationId: "org-1",
    storageLimit: 1000,
    storageUsed: 100,
    ...overrides,
  }
}

function createFile(overrides = {}) {
  return {
    id: "file-1",
    userId: "user-1",
    organizationId: "org-1",
    filename: "factura.pdf",
    mimetype: "application/pdf",
    createdAt: new Date("2026-03-22T10:00:00.000Z"),
    isReviewed: false,
    metadata: {
      mobileTriage: {
        source: "mobile_capture",
        disposition: "pending",
        lastMobileActionAt: "2026-03-22T10:00:00.000Z",
      },
    },
    cachedParseResult: null,
    ...overrides,
  }
}

function createJob(overrides = {}) {
  return {
    id: "job-1",
    fileId: "file-1",
    status: "queued",
    error: null,
    updatedAt: new Date("2026-03-22T10:05:00.000Z"),
    ...overrides,
  }
}

function createSystemStatus(overrides = {}) {
  return {
    llmConfigured: true,
    workerAvailable: true,
    storageAvailable: true,
    blockingReasonCode: null,
    ...overrides,
  }
}

test("createMobileInboxResponse mantiene analyzing en jobs activos y expone worker_unavailable como reasonCode auxiliar", async () => {
  const response = await createMobileInboxResponse(
    {
      user: createUser(),
      files: [createFile()],
      jobsByFileId: new Map([["file-1", [createJob()]]]),
    },
    {
      getSystemStatus: async () => ({
        llmConfigured: true,
        workerAvailable: false,
        storageAvailable: true,
        blockingReasonCode: MOBILE_REASON_CODE.WORKER_UNAVAILABLE,
      }),
    }
  )

  assert.deepEqual(response.systemStatus, {
    llmConfigured: true,
    workerAvailable: false,
    storageAvailable: true,
    blockingReasonCode: MOBILE_REASON_CODE.WORKER_UNAVAILABLE,
  })
  assert.equal(response.items[0]?.state, MOBILE_ITEM_STATE.ANALYZING)
  assert.equal(response.items[0]?.reasonCode, MOBILE_REASON_CODE.WORKER_UNAVAILABLE)
  assert.equal(response.items[0]?.analysisJobId, "job-1")
})

test("createMobileInboxResponse deja reasonCode en null y confidence high cuando estan los cuatro campos heurísticos", async () => {
  const response = await createMobileInboxResponse(
    {
      user: createUser(),
      files: [
        createFile({
          cachedParseResult: {
            merchant: "Proveedor demo",
            issuedAt: "2026-03-22",
            total: 1999,
            invoice_number: "F-2026-001",
          },
        }),
      ],
      jobsByFileId: new Map(),
    },
    {
      getSystemStatus: async () => ({
        llmConfigured: true,
        workerAvailable: true,
        storageAvailable: true,
        blockingReasonCode: null,
      }),
    }
  )

  assert.equal(response.items[0]?.state, MOBILE_ITEM_STATE.READY_FOR_REVIEW)
  assert.equal(response.items[0]?.confidence, "high")
  assert.equal(response.items[0]?.reasonCode, null)
})

test("createMobileInboxResponse marca ready_for_review con low_confidence cuando faltan casi todos los campos heurísticos", async () => {
  const response = await createMobileInboxResponse(
    {
      user: createUser(),
      files: [
        createFile({
          cachedParseResult: {
            merchant: "Proveedor demo",
          },
        }),
      ],
      jobsByFileId: new Map(),
    },
    {
      getSystemStatus: async () => ({
        llmConfigured: true,
        workerAvailable: true,
        storageAvailable: true,
        blockingReasonCode: null,
      }),
    }
  )

  assert.equal(response.items[0]?.state, MOBILE_ITEM_STATE.READY_FOR_REVIEW)
  assert.equal(response.items[0]?.confidence, "low")
  assert.equal(response.items[0]?.reasonCode, MOBILE_REASON_CODE.LOW_CONFIDENCE)
})

test("createMobileInboxResponse marca missing_critical_fields cuando el parseo carece de fecha o total", async () => {
  const response = await createMobileInboxResponse(
    {
      user: createUser(),
      files: [
        createFile({
          cachedParseResult: {
            merchant: "Proveedor demo",
            total: 1999,
            invoice_number: "F-2026-001",
          },
        }),
      ],
      jobsByFileId: new Map(),
    },
    {
      getSystemStatus: async () => ({
        llmConfigured: true,
        workerAvailable: true,
        storageAvailable: true,
        blockingReasonCode: null,
      }),
    }
  )

  assert.equal(response.items[0]?.state, MOBILE_ITEM_STATE.READY_FOR_REVIEW)
  assert.equal(response.items[0]?.reasonCode, MOBILE_REASON_CODE.MISSING_CRITICAL_FIELDS)
  assert.equal(response.items[0]?.confidence, "medium")
})

test("createMobileInboxResponse marca analysis_failed cuando el ultimo job ha fallado", async () => {
  const response = await createMobileInboxResponse(
    {
      user: createUser(),
      files: [createFile()],
      jobsByFileId: new Map([
        [
          "file-1",
          [
            createJob({
              status: "failed",
              error: "timeout",
            }),
          ],
        ],
      ]),
    },
    {
      getSystemStatus: async () => ({
        llmConfigured: true,
        workerAvailable: true,
        storageAvailable: true,
        blockingReasonCode: null,
      }),
    }
  )

  assert.equal(response.items[0]?.state, MOBILE_ITEM_STATE.ERROR)
  assert.equal(response.items[0]?.reasonCode, MOBILE_REASON_CODE.ANALYSIS_FAILED)
})

test("createMobileInboxResponse mantiene analysis_failed persistido aunque no exista job fallido al refrescar", async () => {
  const response = await createMobileInboxResponse(
    {
      user: createUser(),
      files: [
        createFile({
          metadata: {
            mobileTriage: {
              source: "mobile_capture",
              disposition: "deferred",
              reasonCode: MOBILE_REASON_CODE.ANALYSIS_FAILED,
              lastMobileActionAt: "2026-03-22T10:11:00.000Z",
            },
          },
        }),
      ],
      jobsByFileId: new Map(),
    },
    {
      getSystemStatus: async () => ({
        llmConfigured: true,
        workerAvailable: true,
        storageAvailable: true,
        blockingReasonCode: null,
      }),
    }
  )

  assert.equal(response.items[0]?.state, MOBILE_ITEM_STATE.ERROR)
  assert.equal(response.items[0]?.reasonCode, MOBILE_REASON_CODE.ANALYSIS_FAILED)
  assert.equal(response.items[0]?.updatedAt, "2026-03-22T10:11:00.000Z")
})

test("createMobileInboxResponse respeta el diferido manual a desktop", async () => {
  const response = await createMobileInboxResponse(
    {
      user: createUser(),
      files: [
        createFile({
          metadata: {
            mobileTriage: {
              source: "mobile_capture",
              disposition: "deferred",
              lastMobileActionAt: "2026-03-22T10:10:00.000Z",
            },
          },
        }),
      ],
      jobsByFileId: new Map(),
    },
    {
      getSystemStatus: async () => ({
        llmConfigured: true,
        workerAvailable: true,
        storageAvailable: true,
        blockingReasonCode: null,
      }),
    }
  )

  assert.equal(response.items[0]?.state, MOBILE_ITEM_STATE.DEFERRED_TO_DESKTOP)
  assert.equal(response.items[0]?.reasonCode, MOBILE_REASON_CODE.USER_DEFERRED)
  assert.equal(response.items[0]?.updatedAt, "2026-03-22T10:10:00.000Z")
})

test("createMobileInboxResponse entiende disposition cruda deferred_to_desktop en el boundary real", async () => {
  const response = await createMobileInboxResponse(
    {
      user: createUser(),
      files: [
        createFile({
          metadata: {
            mobileTriage: {
              source: "mobile_capture",
              disposition: "deferred_to_desktop",
              lastMobileActionAt: "2026-03-22T10:13:00.000Z",
            },
          },
        }),
      ],
      jobsByFileId: new Map(),
    },
    {
      getSystemStatus: async () => createSystemStatus(),
    }
  )

  assert.equal(response.items[0]?.state, MOBILE_ITEM_STATE.DEFERRED_TO_DESKTOP)
  assert.equal(response.items[0]?.reasonCode, MOBILE_REASON_CODE.USER_DEFERRED)
  assert.equal(response.items[0]?.updatedAt, "2026-03-22T10:13:00.000Z")
})

test("getMobileInbox excluye el fichero aceptado tras limpiar la continuidad movil y el contador implicito baja", async () => {
  const reviewedFile = buildReviewedFileUpdate({
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
  })

  const response = await getMobileInbox(createUser(), {
    findFiles: async () => [
      createFile({
        id: "file-reviewed",
        isReviewed: true,
        filename: reviewedFile.filename,
        metadata: reviewedFile.metadata,
      }),
      createFile({
        id: "file-pending",
        filename: "pendiente.pdf",
      }),
    ],
    findJobs: async () => [],
    getSystemStatus: async () => createSystemStatus(),
  })

  assert.equal(response.items.length, 1)
  assert.equal(response.items[0]?.fileId, "file-pending")
})

test("getMobileInbox excluye un fichero revisado aunque conserve mobileTriage legado", async () => {
  const response = await getMobileInbox(createUser(), {
    findFiles: async () => [
      createFile({
        id: "file-reviewed",
        isReviewed: true,
      }),
    ],
    findJobs: async () => [],
    getSystemStatus: async () => createSystemStatus(),
  })

  assert.equal(response.items.length, 0)
})

test("getMobileInbox excluye ficheros de otra organización aunque pertenezcan al mismo usuario", async () => {
  const response = await getMobileInbox(createUser(), {
    findFiles: async () => [
      createFile({
        id: "file-org-1",
        organizationId: "org-1",
        filename: "org-1.pdf",
      }),
      createFile({
        id: "file-org-2",
        organizationId: "org-2",
        filename: "org-2.pdf",
      }),
    ],
    findJobs: async () => [],
    getSystemStatus: async () => createSystemStatus(),
  })

  assert.deepEqual(
    response.items.map((item) => item.fileId),
    ["file-org-1"]
  )
})

test("getMobileInbox mantiene visibles deferred y analysis_failed con la misma derivacion actual", async () => {
  const response = await getMobileInbox(createUser(), {
    findFiles: async () => [
      createFile({
        id: "file-deferred",
        metadata: {
          mobileTriage: {
            source: "mobile_capture",
            disposition: "deferred",
            lastMobileActionAt: "2026-03-22T10:10:00.000Z",
          },
        },
      }),
      createFile({
        id: "file-analysis-failed",
        metadata: {
          mobileTriage: {
            source: "mobile_capture",
            disposition: "deferred",
            reasonCode: MOBILE_REASON_CODE.ANALYSIS_FAILED,
            lastMobileActionAt: "2026-03-22T10:11:00.000Z",
          },
        },
      }),
    ],
    findJobs: async () => [],
    getSystemStatus: async () => createSystemStatus(),
  })

  assert.equal(response.items.length, 2)
  assert.deepEqual(
    response.items.map((item) => ({
      fileId: item.fileId,
      state: item.state,
      reasonCode: item.reasonCode,
    })),
    [
      {
        fileId: "file-deferred",
        state: MOBILE_ITEM_STATE.DEFERRED_TO_DESKTOP,
        reasonCode: MOBILE_REASON_CODE.USER_DEFERRED,
      },
      {
        fileId: "file-analysis-failed",
        state: MOBILE_ITEM_STATE.ERROR,
        reasonCode: MOBILE_REASON_CODE.ANALYSIS_FAILED,
      },
    ]
  )
})

test("createMobileInboxResponse reutiliza el reasonCode persistido para defer automático", async () => {
  const response = await createMobileInboxResponse(
    {
      user: createUser(),
      files: [
        createFile({
          metadata: {
            mobileTriage: {
              source: "mobile_capture",
              disposition: "deferred",
              reasonCode: MOBILE_REASON_CODE.LLM_NOT_CONFIGURED,
              lastMobileActionAt: "2026-03-22T10:12:00.000Z",
            },
          },
        }),
      ],
      jobsByFileId: new Map(),
    },
    {
      getSystemStatus: async () => ({
        llmConfigured: true,
        workerAvailable: true,
        storageAvailable: true,
        blockingReasonCode: null,
      }),
    }
  )

  assert.equal(response.items[0]?.state, MOBILE_ITEM_STATE.DEFERRED_TO_DESKTOP)
  assert.equal(response.items[0]?.reasonCode, MOBILE_REASON_CODE.LLM_NOT_CONFIGURED)
  assert.equal(response.items[0]?.updatedAt, "2026-03-22T10:12:00.000Z")
})
