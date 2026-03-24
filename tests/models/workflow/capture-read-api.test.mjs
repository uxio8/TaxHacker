import test from "node:test"
import assert from "node:assert/strict"

import { getCaptureWorkflowInboxView } from "../../../models/workflow/document-read-api.ts"

test("getCaptureWorkflowInboxView unifica inbox móvil y cola fiscal del cliente en una lectura estable", async () => {
  const result = await getCaptureWorkflowInboxView(
    {
      id: "user_1",
      organizationId: "org_1",
      email: "demo@acme.test",
      storageLimit: 1000,
      storageUsed: 120,
      membershipExpiresAt: null,
      accessStatus: "enabled",
    },
    {
      getMobileInbox: async () => ({
        items: [
          {
            fileId: "file_1",
            filename: "factura.pdf",
            previewUrl: "/files/preview/file_1",
            state: "ready_for_review",
            reasonCode: "missing_critical_fields",
            confidence: "medium",
            analysisJobId: "job_1",
            updatedAt: "2026-03-23T10:00:00.000Z",
          },
        ],
        systemStatus: {
          llmConfigured: true,
          workerAvailable: true,
          storageAvailable: true,
          blockingReasonCode: null,
        },
      }),
      getFiscalProfileAccessByOrganizationId: async () => ({
        status: "ready",
        profile: { id: "profile_1" },
      }),
      getFiscalReviewQueue: async () => ({
        items: [{ owner: "client" }, { owner: "advisor" }, { owner: "client" }],
      }),
    }
  )

  assert.equal(result.inbox.items.length, 1)
  assert.equal(result.inbox.items[0]?.state, "ready_for_review")
  assert.equal(result.openClientReviewRequestCount, 2)
})

test("getCaptureWorkflowInboxView devuelve cero incidencias si el perfil fiscal no está listo", async () => {
  const result = await getCaptureWorkflowInboxView(
    {
      id: "user_1",
      organizationId: "org_1",
      email: "demo@acme.test",
      storageLimit: 1000,
      storageUsed: 120,
      membershipExpiresAt: null,
      accessStatus: "enabled",
    },
    {
      getMobileInbox: async () => ({
        items: [],
        systemStatus: {
          llmConfigured: true,
          workerAvailable: true,
          storageAvailable: true,
          blockingReasonCode: null,
        },
      }),
      getFiscalProfileAccessByOrganizationId: async () => ({
        status: "pending",
        profile: null,
      }),
      getFiscalReviewQueue: async () => {
        throw new Error("no debería ejecutarse")
      },
    }
  )

  assert.equal(result.openClientReviewRequestCount, 0)
})
