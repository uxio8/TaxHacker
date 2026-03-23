import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { buildModel180Draft } from "../../../models/tax-forms/model-180.ts"
import { loadModel180DraftForTenant } from "../../../models/tax-forms/model-180-loader.ts"

function loadGoldenQuarter() {
  return JSON.parse(
    readFileSync(new URL("../../fixtures/fiscal/golden-quarter.json", import.meta.url), "utf8")
  )
}

function buildQuarterlyDraft(periodKey, operationalStatusCode = "open") {
  const fiscalYear = Number.parseInt(periodKey.slice(0, 4), 10)
  const quarter = Number.parseInt(periodKey.slice(-1), 10)

  return {
    period: {
      id: `period_${periodKey.toLowerCase()}`,
      ownerScopeId: "fp_demo",
      fiscalYear,
      quarter,
      periodKey,
      startsOn: `${fiscalYear}-${String((quarter - 1) * 3 + 1).padStart(2, "0")}-01`,
      endsOn: `${fiscalYear}-${String(quarter * 3).padStart(2, "0")}-31`,
      status: "open",
      countryCode: "ES",
      currencyCode: "EUR",
      createdAt: "2026-03-22T09:00:00.000Z",
      updatedAt: "2026-03-22T09:00:00.000Z",
    },
    periodHref: `/tax/quarters/${periodKey}`,
    operationalStatus: {
      code: operationalStatusCode,
      periodStatus: "open",
      documentCount: 0,
      readyDocumentCount: 0,
      reviewDocumentCount: 0,
      blockingDocumentCount: 0,
    },
  }
}

test("buildModel180Draft agrega el año reutilizando el núcleo trimestral del 115", () => {
  const goldenQuarter = loadGoldenQuarter()
  const documents = goldenQuarter.documents.map((entry) => entry.document)

  const draft = buildModel180Draft({
    documents,
    fiscalYear: 2026,
  })

  assert.equal(draft.period_key, "2026-Y")
  assert.equal(draft.perceptor_count, goldenQuarter.expected_quarter.model_115.perceptor_count)
  assert.equal(draft.rent_base_cents, goldenQuarter.expected_quarter.model_115.rent_base_cents)
  assert.equal(draft.withholding_cents, goldenQuarter.expected_quarter.model_115.withholding_cents)
  assert.deepEqual(draft.documents_included, goldenQuarter.expected_quarter.model_115.documents_included)
  assert.equal(draft.perceptors.length, 1)
  assert.deepEqual(draft.quarter_summaries.map((summary) => ({
    quarter: summary.quarter,
    documents_included: summary.documents_included.length,
    perceptor_count: summary.perceptor_count,
    rent_base_cents: summary.rent_base_cents,
    withholding_cents: summary.withholding_cents,
  })), [
    {
      quarter: 1,
      documents_included: 1,
      perceptor_count: 1,
      rent_base_cents: 100000,
      withholding_cents: 19000,
    },
    {
      quarter: 2,
      documents_included: 0,
      perceptor_count: 0,
      rent_base_cents: 0,
      withholding_cents: 0,
    },
    {
      quarter: 3,
      documents_included: 0,
      perceptor_count: 0,
      rent_base_cents: 0,
      withholding_cents: 0,
    },
    {
      quarter: 4,
      documents_included: 0,
      perceptor_count: 0,
      rent_base_cents: 0,
      withholding_cents: 0,
    },
  ])
  assert.equal(draft.source_lines.length, 1)
  assert.equal(draft.source_lines[0].quarter, 1)
  assert.equal(draft.source_lines[0].annual_period_key, "2026-Y")
})

test("loadModel180DraftForTenant usa el periodo anual pedido y resume readiness de alquileres con retención", async () => {
  const goldenQuarter = loadGoldenQuarter()
  const documents = goldenQuarter.documents.map((entry) => structuredClone(entry.document))
  const blockedRent = structuredClone(
    goldenQuarter.documents.find((entry) => entry.case_id === "received-rent-withholding").document
  )

  blockedRent.header.fiscal_document_id = "fd_q1_002_blocked"
  blockedRent.header.source_transaction_id = "tx_q1_002_blocked"
  blockedRent.header.review_status = "blocked"
  blockedRent.header.review_reasons = ["counterparty_tax_id_missing"]
  blockedRent.lines = blockedRent.lines.map((line) => ({
    ...line,
    fiscal_document_id: "fd_q1_002_blocked",
    line_id: `fd_q1_002_blocked_l${line.line_number}`,
    is_ready_for_withholding_books: false,
  }))

  const result = await loadModel180DraftForTenant(
    {
      organizationId: "org_demo",
      userId: "user_demo",
      periodKey: "2026-Y",
    },
    {
      getFiscalProfileAccessByOrganizationId: async () => ({
        status: "ready",
        profile: {
          id: "fp_demo",
          companyName: "TaxHacker Demo SL",
          taxId: "B12345678",
        },
      }),
      listQuarterlyDrafts: async () => [buildQuarterlyDraft("2026-Q2", "open"), buildQuarterlyDraft("2026-Q1", "ready")],
      listTransactionFiscalDocuments: async () => [...documents, blockedRent],
    }
  )

  assert.equal(result.status, "ready")
  assert.equal(result.period.periodKey, "2026-Y")
  assert.equal(result.period.fiscalYear, 2026)
  assert.equal(result.period.selectionSource, "requested")
  assert.deepEqual(result.availablePeriodKeys, ["2026-Y"])
  assert.deepEqual(result.readiness, {
    candidate_document_count: 2,
    included_document_count: 1,
    ready_document_count: 1,
    blocked_document_count: 1,
    needs_review_document_count: 0,
    pending_document_count: 0,
    source_line_count: 1,
  })
})

test("loadModel180DraftForTenant conserva un resultado seguro cuando falta el perfil fiscal", async () => {
  const result = await loadModel180DraftForTenant(
    {
      organizationId: "org_demo",
      userId: "user_demo",
    },
    {
      getFiscalProfileAccessByOrganizationId: async () => ({
        status: "profile_missing",
        profile: null,
      }),
      listQuarterlyDrafts: async () => {
        throw new Error("no debería cargar trimestres sin perfil fiscal")
      },
      listTransactionFiscalDocuments: async () => {
        throw new Error("no debería cargar facts sin perfil fiscal")
      },
    }
  )

  assert.deepEqual(result, {
    status: "profile_missing",
    availablePeriodKeys: [],
  })
})
