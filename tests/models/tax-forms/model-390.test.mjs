import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { buildModel390Draft } from "../../../models/tax-forms/model-390.ts"
import { loadModel390DraftForTenant } from "../../../models/tax-forms/model-390-loader.ts"

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

test("buildModel390Draft agrega el año reutilizando el núcleo trimestral del 303", () => {
  const goldenQuarter = loadGoldenQuarter()
  const documents = goldenQuarter.documents.map((entry) => entry.document)

  const draft = buildModel390Draft({
    documents,
    fiscalYear: 2026,
  })

  assert.equal(draft.period_key, "2026-Y")
  assert.deepEqual(draft.documents_included, goldenQuarter.expected_quarter.model_303.documents_included)
  assert.equal(draft.output_vat_total_cents, goldenQuarter.expected_quarter.model_303.output_vat_total_cents)
  assert.equal(draft.input_vat_deductible_total_cents, goldenQuarter.expected_quarter.model_303.input_vat_deductible_total_cents)
  assert.equal(draft.input_vat_non_deductible_total_cents, 2300)
  assert.equal(draft.result_vat_payable_cents, goldenQuarter.expected_quarter.model_303.result_vat_payable_cents)
  assert.deepEqual(
    draft.quarter_summaries.map((summary) => ({
      quarter: summary.quarter,
      documents_included: summary.documents_included.length,
      output_vat_total_cents: summary.output_vat_total_cents,
      input_vat_deductible_total_cents: summary.input_vat_deductible_total_cents,
      input_vat_non_deductible_total_cents: summary.input_vat_non_deductible_total_cents,
      result_vat_payable_cents: summary.result_vat_payable_cents,
    })),
    [
      {
        quarter: 1,
        documents_included: 7,
        output_vat_total_cents: goldenQuarter.expected_quarter.model_303.output_vat_total_cents,
        input_vat_deductible_total_cents: goldenQuarter.expected_quarter.model_303.input_vat_deductible_total_cents,
        input_vat_non_deductible_total_cents: 2300,
        result_vat_payable_cents: goldenQuarter.expected_quarter.model_303.result_vat_payable_cents,
      },
      {
        quarter: 2,
        documents_included: 0,
        output_vat_total_cents: 0,
        input_vat_deductible_total_cents: 0,
        input_vat_non_deductible_total_cents: 0,
        result_vat_payable_cents: 0,
      },
      {
        quarter: 3,
        documents_included: 0,
        output_vat_total_cents: 0,
        input_vat_deductible_total_cents: 0,
        input_vat_non_deductible_total_cents: 0,
        result_vat_payable_cents: 0,
      },
      {
        quarter: 4,
        documents_included: 0,
        output_vat_total_cents: 0,
        input_vat_deductible_total_cents: 0,
        input_vat_non_deductible_total_cents: 0,
        result_vat_payable_cents: 0,
      },
    ]
  )
  assert.ok(draft.trace_rows.some((row) => row.quarter === 1))
})

test("loadModel390DraftForTenant cae al año activo cuando no llega periodKey", async () => {
  const goldenQuarter = loadGoldenQuarter()

  const result = await loadModel390DraftForTenant(
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
  assert.equal(result.period.periodKey, "2026-Y")
  assert.equal(result.period.selectionSource, "active")
  assert.deepEqual(result.availablePeriodKeys, ["2026-Y", "2025-Y"])
  assert.equal(result.readiness.candidate_document_count, 7)
  assert.equal(result.readiness.included_document_count, 7)
})

test("loadModel390DraftForTenant conserva un resultado seguro cuando falta el perfil fiscal", async () => {
  const result = await loadModel390DraftForTenant(
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
