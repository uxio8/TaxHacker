import assert from "node:assert/strict"
import test from "node:test"

const attentionModule = await import(new URL("../../models/attention-runtime.ts", import.meta.url))

function createDependencies(overrides = {}) {
  return {
    getSettings: async () => ({ llm_provider_1: "pool_cloud" }),
    getLLMSettings: () => ({ providers: [{ provider: "pool_cloud" }] }),
    getUnsortedFiles: async () => [
      { isReviewed: false, metadata: { mobileTriage: { disposition: "deferred" } } },
      { isReviewed: false, metadata: null },
    ],
    getFields: async () => [{ key: "category" }],
    getTransactions: async () => ({
      transactions: [{ id: "tx_1", category: null }],
    }),
    isTransactionIncomplete: (fields, transaction) => {
      return fields.some((field) => field.key === "category") && transaction.category == null
    },
    getFiscalProfileAccessByOrganizationId: async () => ({
      status: "ready",
      profile: { id: "profile_1" },
    }),
    getFiscalReviewQueue: async () => ({
      summary: {
        blocked: 2,
        needs_review: 1,
      },
    }),
    listQuarterlyDrafts: async () => [
      {
        period: { periodKey: "2026-Q1" },
        operationalStatus: { code: "review_pending" },
      },
    ],
    detectLocalBackupBaseline: async () => true,
    ...overrides,
  }
}

test("getAttentionSummary mantiene la señal completa de dashboard con libro y trimestre activo", async () => {
  const summary = await attentionModule.getAttentionSummaryRuntime(
    {
      organizationId: "org_1",
      organizationName: "Acme SL",
      userId: "user_1",
      businessAddress: "Calle Mayor 1",
      selfHosted: true,
    },
    createDependencies()
  )

  assert.equal(summary.counts.unsorted, 2)
  assert.equal(summary.counts.deferredToDesktop, 1)
  assert.equal(summary.counts.transactionExceptions, 1)
  assert.equal(summary.counts.fiscalBlocked, 2)
  assert.equal(summary.items.find((item) => item.id === "tax_blocked")?.description.includes("2026-Q1"), true)
  assert.equal(summary.items.find((item) => item.id === "transaction_exceptions")?.href, "/transactions?quickView=incomplete")
})

test("getNavigationAttentionSummary reutiliza la misma base pero no depende de transactions ni drafts", async () => {
  const summary = await attentionModule.getNavigationAttentionSummaryRuntime(
    {
      organizationId: "org_1",
      organizationName: "Acme SL",
      userId: "user_1",
      businessAddress: "Calle Mayor 1",
      selfHosted: true,
    },
    createDependencies({
      getFields: async () => {
        throw new Error("no debería pedir campos en navegación")
      },
      getTransactions: async () => {
        throw new Error("no debería pedir transactions en navegación")
      },
      listQuarterlyDrafts: async () => {
        throw new Error("no debería pedir drafts en navegación")
      },
    })
  )

  assert.equal(summary.counts.unsorted, 2)
  assert.equal(summary.counts.deferredToDesktop, 1)
  assert.equal(summary.counts.transactionExceptions, 0)
  assert.equal(summary.counts.fiscalBlocked, 2)
  assert.equal(summary.items.some((item) => item.id === "transaction_exceptions"), false)
  assert.equal(summary.items.find((item) => item.id === "tax_blocked")?.description.includes("2026-Q1"), false)
})
