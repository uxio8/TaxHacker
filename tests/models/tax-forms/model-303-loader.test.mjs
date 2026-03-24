import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { loadModel303Draft } from "../../../models/tax-forms/model-303-loader.ts"

function loadGoldenQuarter() {
  return JSON.parse(
    readFileSync(new URL("../../fixtures/fiscal/golden-quarter.json", import.meta.url), "utf8")
  )
}

function createQuarterlyDraft({
  periodKey,
  status = "open",
  model303DocumentCount = 0,
  reviewDocumentCount = 0,
  blockingDocumentCount = 0,
}) {
  return {
    period: {
      fiscalYear: Number.parseInt(periodKey.slice(0, 4), 10),
      quarter: Number.parseInt(periodKey.slice(-1), 10),
      periodKey,
      status,
    },
    periodHref: `/tax/quarters/${periodKey}`,
    operationalStatus: {
      code: status === "closed" ? "closed" : "open",
      periodStatus: status,
      documentCount: model303DocumentCount + reviewDocumentCount + blockingDocumentCount,
      readyDocumentCount: model303DocumentCount,
      reviewDocumentCount,
      blockingDocumentCount,
    },
    reviewStatusCounts: {
      ready: model303DocumentCount,
      needs_review: reviewDocumentCount,
      blocked: blockingDocumentCount,
      pending: 0,
    },
    reviewStatusTotals: {},
    totals: {
      documentCount: model303DocumentCount + reviewDocumentCount + blockingDocumentCount,
      observedAmountCents: 0,
      totalNetCents: 0,
      totalVatCents: 0,
      totalWithholdingCents: 0,
      totalGrossCents: 0,
      totalPayableCents: 0,
      model303DocumentCount,
      model115DocumentCount: 0,
    },
    model303DocumentIds: [],
    model115DocumentIds: [],
    documents: [],
  }
}

test("loadModel303Draft usa el periodo pedido si existe y devuelve readiness del trimestre", async () => {
  const goldenQuarter = loadGoldenQuarter()
  const documents = goldenQuarter.documents.map((entry) => structuredClone(entry.document))

  documents[0].header.review_status = "blocked"
  documents[0].header.review_reasons = ["missing_vat_breakdown"]
  documents[1].header.review_status = "needs_review"
  documents[1].header.review_reasons = ["missing_counterparty_tax_id"]

  const result = await loadModel303Draft("fp_1", {
    periodKey: "2026-Q1",
    getQuarterlyDraftByPeriodKey: async (ownerScopeId, periodKey) => {
      assert.equal(ownerScopeId, "fp_1")
      assert.equal(periodKey, "2026-Q1")
      return createQuarterlyDraft({
        periodKey: "2026-Q1",
        model303DocumentCount: 7,
      })
    },
    listQuarterlyDrafts: async () => {
      throw new Error("no deberia listar trimestres si viene periodKey")
    },
    listTransactionFiscalDocuments: async () => documents,
  })

  assert.equal(result.periodKey, "2026-Q1")
  assert.equal(result.quarterLabel, "2026-Q1")
  assert.equal(result.readiness.status, "attention_required")
  assert.equal(result.readiness.summary.model303CandidateCount, 7)
  assert.equal(result.readiness.summary.reviewDocumentCount, 1)
  assert.equal(result.readiness.summary.blockingDocumentCount, 1)
  assert.ok(result.readiness.summary.skippedDocumentCount >= 0)
  assert.deepEqual(result.availablePeriodKeys, ["2026-Q1"])
})

test("loadModel303Draft cae al trimestre activo cuando no llega periodKey", async () => {
  const goldenQuarter = loadGoldenQuarter()
  const documents = goldenQuarter.documents.map((entry) => entry.document)

  const result = await loadModel303Draft("fp_1", {
    listQuarterlyDrafts: async (ownerScopeId) => {
      assert.equal(ownerScopeId, "fp_1")
      return [
        createQuarterlyDraft({ periodKey: "2025-Q4", status: "closed", model303DocumentCount: 4 }),
        createQuarterlyDraft({ periodKey: "2026-Q1", model303DocumentCount: 6, reviewDocumentCount: 1 }),
      ]
    },
    getQuarterlyDraftByPeriodKey: async () => {
      throw new Error("no deberia pedir un periodo concreto")
    },
    listTransactionFiscalDocuments: async () => documents,
  })

  assert.equal(result.periodKey, "2026-Q1")
  assert.deepEqual(result.availablePeriodKeys, ["2025-Q4", "2026-Q1"])
})

test("loadModel303Draft devuelve un borrador vacio pero valido cuando el trimestre existe sin facts listos", async () => {
  const result = await loadModel303Draft("fp_1", {
    periodKey: "2026-Q2",
    getQuarterlyDraftByPeriodKey: async () =>
      createQuarterlyDraft({ periodKey: "2026-Q2", model303DocumentCount: 0 }),
    listQuarterlyDrafts: async () => [],
    listTransactionFiscalDocuments: async () => [],
  })

  assert.equal(result.periodKey, "2026-Q2")
  assert.deepEqual(result.draft.documents_included, [])
  assert.equal(result.draft.output_vat_total_cents, 0)
  assert.equal(result.readiness.status, "missing_period")
  assert.equal(result.readiness.summary.model303CandidateCount, 0)
  assert.equal(result.readiness.summary.skippedDocumentCount, 0)
})

test("loadModel303Draft devuelve null cuando no hay trimestres fiscales todavia", async () => {
  const result = await loadModel303Draft("fp_1", {
    listQuarterlyDrafts: async () => [],
    getQuarterlyDraftByPeriodKey: async () => null,
    listTransactionFiscalDocuments: async () => {
      throw new Error("no deberia cargar facts si no hay trimestre")
    },
  })

  assert.equal(result, null)
})
