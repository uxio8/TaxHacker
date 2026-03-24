import test from "node:test"
import assert from "node:assert/strict"

import { getDashboardWorkflowDocumentView, getUnsortedWorkflowDocumentView } from "../../../models/workflow/document-read-api.ts"

function createFile(id, filename, overrides = {}) {
  return {
    id,
    path: `/tmp/${id}`,
    createdAt: new Date("2026-03-23T10:00:00.000Z"),
    userId: "user_1",
    organizationId: "org_1",
    filename,
    mimetype: "application/pdf",
    metadata: null,
    cachedParseResult: null,
    isReviewed: false,
    isSplitted: false,
    ...overrides,
  }
}

test("getDashboardWorkflowDocumentView unifica atención y slice documental sobre una read API estable", async () => {
  const file = createFile("file_1", "factura.pdf", {
    cachedParseResult: {
      merchant: "Proveedor SL",
      total: "120.00",
    },
  })

  const attentionSummary = {
    readiness: {
      isReady: false,
      mode: "setup",
      completedCount: 1,
      totalCount: 2,
      steps: [
        {
          key: "llm",
          title: "Configura IA",
          description: "Falta un proveedor.",
          href: "/settings/llm",
          actionLabel: "Abrir IA",
          complete: false,
          blocking: true,
        },
      ],
      nextStep: null,
    },
    items: [
      {
        id: "setup_llm",
        title: "Configura IA",
        description: "Falta un proveedor.",
        nextActionLabel: "Abrir IA",
        href: "/settings/llm",
        count: 1,
        state: "blocked",
        priority: "critical",
        recommendedSurface: "settings",
      },
      {
        id: "unsorted_review",
        title: "Hay documentos por revisar",
        description: "La bandeja sigue viva.",
        nextActionLabel: "Abrir inbox",
        href: "/unsorted",
        count: 1,
        state: "needs_action",
        priority: "high",
        recommendedSurface: "unsorted",
      },
    ],
    topItem: null,
    counts: {
      unsorted: 1,
      deferredToDesktop: 0,
      fiscalBlocked: 0,
      fiscalNeedsReview: 0,
      transactionExceptions: 0,
    },
  }

  const result = await getDashboardWorkflowDocumentView(
    {
      organizationId: "org_1",
      organizationName: "Acme SL",
      userId: "user_1",
      businessAddress: "Calle Falsa 123",
    },
    {
      getAttentionSummary: async () => attentionSummary,
      getUnsortedFiles: async () => [file],
      getSettings: async () => ({ llm_provider_1: "pool_cloud" }),
      getLLMSettings: () => ({
        providers: [{ provider: "pool_cloud" }],
      }),
    }
  )

  assert.equal(result.attention.items.length, 2)
  assert.equal(result.attentionWorkflow.items.length, 2)
  assert.equal(result.attentionWorkflow.posture.code, "blocked")
  assert.equal(result.unsorted.files.length, 1)
  assert.equal(result.unsorted.summaries[0].state, "ready_to_review")
  assert.equal(result.unsorted.items[0].source, "documents")
  assert.equal(result.unsorted.hasConfiguredLlmProvider, true)
})

test("getUnsortedWorkflowDocumentView agrupa el inbox documental y las incidencias fiscales del cliente", async () => {
  const files = [
    createFile("file_ready", "ticket.pdf", {
      cachedParseResult: {
        merchant: "Bar Paco",
      },
    }),
    createFile("file_pending", "otro.pdf"),
  ]

  const result = await getUnsortedWorkflowDocumentView(
    {
      organizationId: "org_1",
      userId: "user_1",
    },
    {
      getUnsortedFiles: async () => files,
      getSettings: async () => ({ llm_provider_1: "pool_cloud" }),
      getLLMSettings: () => ({
        providers: [{ provider: "pool_cloud" }],
      }),
      getFiscalProfileAccessByOrganizationId: async () => ({
        status: "ready",
        profile: { id: "profile_1" },
      }),
      getFiscalReviewQueue: async () => ({
        items: [
          { owner: "client" },
          { owner: "advisor" },
          { owner: "client" },
        ],
      }),
    }
  )

  assert.equal(result.files.length, 2)
  assert.equal(result.summaries.length, 2)
  assert.equal(result.items.length, 2)
  assert.equal(result.counts.saveable, 1)
  assert.equal(result.counts.deferredToDesktop, 0)
  assert.equal(result.counts.openClientReviewRequests, 2)
  assert.equal(result.hasConfiguredLlmProvider, true)
  assert.equal(result.items[0].status, "ready")
})
