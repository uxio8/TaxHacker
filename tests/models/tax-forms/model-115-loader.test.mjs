import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { loadModel115DraftForTenant } from "../../../models/tax-forms/model-115-loader.ts"

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

test("loadModel115DraftForTenant usa el periodo pedido y resume readiness documental del tenant", async () => {
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

  const result = await loadModel115DraftForTenant(
    {
      organizationId: "org_demo",
      userId: "user_demo",
      periodKey: "2026-Q1",
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
  assert.equal(result.period.periodKey, "2026-Q1")
  assert.equal(result.period.selectionSource, "requested")
  assert.deepEqual(result.availablePeriodKeys, ["2026-Q2", "2026-Q1"])
  assert.equal(result.profile.companyName, "TaxHacker Demo SL")
  assert.deepEqual(result.draft.documents_included, ["fd_q1_002"])
  assert.equal(result.draft.perceptor_count, 1)
  assert.equal(result.draft.perceptors.length, 1)
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

test("loadModel115DraftForTenant cae al periodo activo cuando no se pasa periodKey", async () => {
  const goldenQuarter = loadGoldenQuarter()

  const result = await loadModel115DraftForTenant(
    {
      organizationId: "org_demo",
      userId: "user_demo",
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
      listQuarterlyDrafts: async () => [
        buildQuarterlyDraft("2025-Q4", "closed"),
        buildQuarterlyDraft("2026-Q2", "presented"),
        buildQuarterlyDraft("2026-Q1", "open"),
      ],
      listTransactionFiscalDocuments: async () => goldenQuarter.documents.map((entry) => entry.document),
    }
  )

  assert.equal(result.status, "ready")
  assert.equal(result.period.periodKey, "2026-Q1")
  assert.equal(result.period.selectionSource, "active")
})

test("loadModel115DraftForTenant conserva un resultado seguro cuando falta el perfil fiscal", async () => {
  let listQuarterlyDraftsCalls = 0
  let listTransactionCalls = 0

  const result = await loadModel115DraftForTenant(
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
        listQuarterlyDraftsCalls += 1
        return []
      },
      listTransactionFiscalDocuments: async () => {
        listTransactionCalls += 1
        return []
      },
    }
  )

  assert.deepEqual(result, {
    status: "profile_missing",
    availablePeriodKeys: [],
  })
  assert.equal(listQuarterlyDraftsCalls, 0)
  assert.equal(listTransactionCalls, 0)
})
