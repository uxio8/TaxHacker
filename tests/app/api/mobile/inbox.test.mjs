import assert from "node:assert/strict"
import test from "node:test"

import { createMobileInboxRoute } from "../../../../app/api/mobile/inbox/create-route.ts"

test("GET /api/mobile/inbox responde 401 sin sesion", async () => {
  const handler = createMobileInboxRoute({
    getSession: async () => null,
    getMobileInbox: async () => {
      throw new Error("no debe ejecutarse")
    },
  })

  const response = await handler(new Request("http://localhost/api/mobile/inbox"))

  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: "Unauthorized" })
})

test("GET /api/mobile/inbox devuelve items y systemStatus del backend movil", async () => {
  const handler = createMobileInboxRoute({
    getSession: async () => ({ user: { id: "user-1" } }),
    getUserById: async () => ({
      id: "user-1",
      organizationId: "org-1",
      storageLimit: 1000,
      storageUsed: 250,
    }),
    getMobileInbox: async () => ({
      items: [
        {
          fileId: "file-1",
          filename: "factura.pdf",
          previewUrl: "/files/preview/file-1",
          state: "ready_for_review",
          reasonCode: "missing_critical_fields",
          confidence: "medium",
          analysisJobId: "job-1",
          updatedAt: "2026-03-22T10:00:00.000Z",
        },
      ],
      systemStatus: {
        llmConfigured: true,
        workerAvailable: false,
        storageAvailable: true,
        blockingReasonCode: "worker_unavailable",
      },
    }),
  })

  const response = await handler(new Request("http://localhost/api/mobile/inbox"))

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    items: [
      {
        fileId: "file-1",
        filename: "factura.pdf",
        previewUrl: "/files/preview/file-1",
        state: "ready_for_review",
        reasonCode: "missing_critical_fields",
        confidence: "medium",
        analysisJobId: "job-1",
        updatedAt: "2026-03-22T10:00:00.000Z",
      },
    ],
    systemStatus: {
      llmConfigured: true,
      workerAvailable: false,
      storageAvailable: true,
      blockingReasonCode: "worker_unavailable",
    },
  })
})

test("GET /api/mobile/inbox carga el usuario real y no inventa storage cuando esta lleno", async () => {
  let receivedUser = null

  const handler = createMobileInboxRoute({
    getSession: async () => ({ user: { id: "user-1" } }),
    getUserById: async () => ({
      id: "user-1",
      organizationId: "org-1",
      storageLimit: 512,
      storageUsed: 512,
    }),
    getMobileInbox: async (user) => {
      receivedUser = user

      return {
        items: [],
        systemStatus: {
          llmConfigured: true,
          workerAvailable: true,
          storageAvailable: false,
          blockingReasonCode: null,
        },
      }
    },
  })

  const response = await handler(new Request("http://localhost/api/mobile/inbox"))

  assert.equal(response.status, 200)
  assert.deepEqual(receivedUser, {
    id: "user-1",
    organizationId: "org-1",
    storageLimit: 512,
    storageUsed: 512,
  })
  assert.deepEqual(await response.json(), {
    items: [],
    systemStatus: {
      llmConfigured: true,
      workerAvailable: true,
      storageAvailable: false,
      blockingReasonCode: null,
    },
  })
})
