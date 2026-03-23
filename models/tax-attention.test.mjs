import assert from "node:assert/strict"
import test from "node:test"

import { buildTaxAttention, getTaxAttention } from "./tax-attention.ts"

function createDraft({
  periodKey,
  periodStatus = "open",
  operationalStatusCode = "open",
  reviewDocumentCount = 0,
  blockingDocumentCount = 0,
  documentCount = 0,
} = {}) {
  return {
    period: {
      id: `period_${periodKey}`,
      ownerScopeId: "fp_1",
      fiscalYear: Number(periodKey.slice(0, 4)),
      quarter: Number(periodKey.slice(-1)),
      periodKey,
      startsOn: "2026-01-01",
      endsOn: "2026-03-31",
      status: periodStatus,
      countryCode: "ES",
      currencyCode: "EUR",
      createdAt: "2026-03-21T09:00:00.000Z",
      updatedAt: "2026-03-21T09:00:00.000Z",
    },
    periodHref: `/tax/quarters/${periodKey}`,
    operationalStatus: {
      code: operationalStatusCode,
      periodStatus,
      documentCount,
      readyDocumentCount: Math.max(documentCount - reviewDocumentCount - blockingDocumentCount, 0),
      reviewDocumentCount,
      blockingDocumentCount,
    },
    reviewStatusCounts: {
      ready: 0,
      needs_review: reviewDocumentCount,
      blocked: blockingDocumentCount,
      pending: 0,
    },
    reviewStatusTotals: {
      ready: { reviewStatus: "ready", documentCount: 0 },
      needs_review: { reviewStatus: "needs_review", documentCount: reviewDocumentCount },
      blocked: { reviewStatus: "blocked", documentCount: blockingDocumentCount },
      pending: { reviewStatus: "pending", documentCount: 0 },
    },
    totals: {
      documentCount,
      observedAmountCents: 0,
      totalNetCents: 0,
      totalVatCents: 0,
      totalWithholdingCents: 0,
      totalGrossCents: 0,
      totalPayableCents: 0,
      model303DocumentCount: 0,
      model115DocumentCount: 0,
    },
    model303DocumentIds: [],
    model115DocumentIds: [],
    documents: [],
  }
}

test("buildTaxAttention prioriza la cola bloqueada y enfoca el trimestre activo", () => {
  const attention = buildTaxAttention({
    drafts: [
      createDraft({
        periodKey: "2026-Q1",
        operationalStatusCode: "review_pending",
        reviewDocumentCount: 3,
        documentCount: 12,
      }),
      createDraft({
        periodKey: "2025-Q4",
        operationalStatusCode: "closed",
        periodStatus: "closed",
        documentCount: 18,
      }),
    ],
    queue: {
      summary: {
        total: 3,
        blocked: 2,
        needs_review: 1,
      },
      items: [],
    },
  })

  assert.equal(attention.activeQuarter?.periodKey, "2026-Q1")
  assert.equal(attention.summary.blockedDocuments, 2)
  assert.equal(attention.summary.needsReviewDocuments, 1)
  assert.deepEqual(attention.nextAction, {
    kind: "review_blocked",
    href: "/tax/review",
    moduleId: "review",
  })
})

test("buildTaxAttention abre el trimestre activo cuando no quedan incidencias de revision", () => {
  const attention = buildTaxAttention({
    drafts: [
      createDraft({
        periodKey: "2026-Q2",
        operationalStatusCode: "ready",
        periodStatus: "ready",
        documentCount: 8,
      }),
      createDraft({
        periodKey: "2026-Q1",
        operationalStatusCode: "closed",
        periodStatus: "closed",
        documentCount: 14,
      }),
    ],
    queue: {
      summary: {
        total: 0,
        blocked: 0,
        needs_review: 0,
      },
      items: [],
    },
  })

  assert.equal(attention.activeQuarter?.periodKey, "2026-Q2")
  assert.deepEqual(attention.nextAction, {
    kind: "open_active_quarter",
    href: "/tax/quarters/2026-Q2",
    moduleId: "quarters",
  })
})

test("getTaxAttention reutiliza queue y quarterly drafts con el mismo ownerScopeId normalizado", async () => {
  const calls = []

  const attention = await getTaxAttention(" fp_1 ", {
    getFiscalReviewQueue: async (ownerScopeId) => {
      calls.push(["queue", ownerScopeId])
      return {
        summary: {
          total: 0,
          blocked: 0,
          needs_review: 0,
        },
        items: [],
      }
    },
    listQuarterlyDrafts: async (ownerScopeId) => {
      calls.push(["drafts", ownerScopeId])
      return [createDraft({ periodKey: "2026-Q3", operationalStatusCode: "open" })]
    },
  })

  assert.deepEqual(calls, [
    ["queue", "fp_1"],
    ["drafts", "fp_1"],
  ])
  assert.equal(attention.activeQuarter?.periodKey, "2026-Q3")
})
