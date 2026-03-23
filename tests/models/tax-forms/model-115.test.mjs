import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  buildModel115Draft,
  MODEL_115_DRILLDOWN_BASE_PATH,
} from "../../../models/tax-forms/model-115.ts"

function loadGoldenQuarter() {
  return JSON.parse(
    readFileSync(new URL("../../fixtures/fiscal/golden-quarter.json", import.meta.url), "utf8")
  )
}

function getGoldenDocument(caseId) {
  const document = loadGoldenQuarter().documents.find((entry) => entry.case_id === caseId)

  assert.ok(document, `No existe el caso ${caseId} en el golden quarter`)
  return document
}

test("buildModel115Draft reproduce el resumen trimestral esperado del golden quarter", () => {
  const goldenQuarter = loadGoldenQuarter()
  const documents = [...goldenQuarter.documents].reverse().map((entry) => entry.document)

  const draft = buildModel115Draft({
    documents,
    fiscalYear: goldenQuarter.quarter.fiscal_year,
    quarter: goldenQuarter.quarter.quarter,
  })

  assert.deepEqual(
    {
      documents_included: draft.documents_included,
      landlord_counterparty_ids: draft.landlord_counterparty_ids,
      perceptor_count: draft.perceptor_count,
      rent_base_cents: draft.rent_base_cents,
      withholding_cents: draft.withholding_cents,
    },
    goldenQuarter.expected_quarter.model_115
  )

  assert.equal(draft.source_lines.length, 1)
  assert.equal(draft.readiness.candidate_document_count, 1)
  assert.equal(draft.readiness.included_document_count, 1)
  assert.equal(draft.readiness.ready_document_count, 1)
  assert.equal(draft.perceptors.length, 1)
  assert.deepEqual(draft.source_lines[0], {
    fiscal_document_id: "fd_q1_002",
    source_transaction_id: "tx_q1_002",
    source_transaction_href: `${MODEL_115_DRILLDOWN_BASE_PATH}/tx_q1_002`,
    line_id: "fd_q1_002_l1",
    line_number: 1,
    issue_date: "2026-02-01",
    invoice_number: "ALQ-2026-02",
    counterparty_id: "cp_inmuebles_gran_via_sl",
    counterparty_name: "Inmuebles Gran Via SL",
    counterparty_tax_id: "B76543210",
    concept: "Renta mensual del local",
    withholding_period_key: "2026-Q1",
    withholding_rate_bps: 1900,
    rent_base_cents: 100000,
    withholding_cents: 19000,
  })
})

test("buildModel115Draft excluye líneas sin retención de alquiler lista o fuera del trimestre", () => {
  const officeSupplies = structuredClone(getGoldenDocument("received-office-supplies").document)
  const rentInvoice = structuredClone(getGoldenDocument("received-rent-withholding").document)
  const wrongPeriodRent = structuredClone(rentInvoice)
  wrongPeriodRent.header.fiscal_document_id = "fd_q1_002_wrong_period"
  wrongPeriodRent.header.source_transaction_id = "tx_q1_002_wrong_period"
  wrongPeriodRent.header.withholding_period_assignment.period_key = "2026-Q2"
  wrongPeriodRent.header.withholding_period_assignment.quarter = 2
  wrongPeriodRent.lines = wrongPeriodRent.lines.map((line) => ({
    ...line,
    fiscal_document_id: wrongPeriodRent.header.fiscal_document_id,
    line_id: `${wrongPeriodRent.header.fiscal_document_id}_l${line.line_number}`,
  }))

  const notReadyRent = structuredClone(rentInvoice)
  notReadyRent.header.fiscal_document_id = "fd_q1_002_not_ready"
  notReadyRent.header.source_transaction_id = "tx_q1_002_not_ready"
  notReadyRent.lines = notReadyRent.lines.map((line) => ({
    ...line,
    fiscal_document_id: notReadyRent.header.fiscal_document_id,
    line_id: `${notReadyRent.header.fiscal_document_id}_l${line.line_number}`,
    is_ready_for_withholding_books: false,
  }))

  const nonRentWithholding = structuredClone(rentInvoice)
  nonRentWithholding.header.fiscal_document_id = "fd_q1_002_non_rent"
  nonRentWithholding.header.source_transaction_id = "tx_q1_002_non_rent"
  nonRentWithholding.lines = nonRentWithholding.lines.map((line) => ({
    ...line,
    fiscal_document_id: nonRentWithholding.header.fiscal_document_id,
    line_id: `${nonRentWithholding.header.fiscal_document_id}_l${line.line_number}`,
    withholding_regime: "salary",
  }))

  const draft = buildModel115Draft({
    documents: [officeSupplies, wrongPeriodRent, notReadyRent, nonRentWithholding],
    fiscalYear: 2026,
    quarter: 1,
  })

  assert.deepEqual(
    {
      documents_included: draft.documents_included,
      landlord_counterparty_ids: draft.landlord_counterparty_ids,
      perceptor_count: draft.perceptor_count,
      rent_base_cents: draft.rent_base_cents,
      withholding_cents: draft.withholding_cents,
      readiness: draft.readiness,
      source_lines: draft.source_lines,
    },
    {
      documents_included: [],
      landlord_counterparty_ids: [],
      perceptor_count: 0,
      rent_base_cents: 0,
      withholding_cents: 0,
      readiness: {
        candidate_document_count: 1,
        included_document_count: 0,
        ready_document_count: 0,
        blocked_document_count: 0,
        needs_review_document_count: 0,
        pending_document_count: 0,
        source_line_count: 0,
      },
      source_lines: [],
    }
  )
})

test("buildModel115Draft permite retencion en un trimestre distinto al IVA del mismo documento", () => {
  const splitRent = structuredClone(getGoldenDocument("received-rent-withholding").document)

  splitRent.header.withholding_period_assignment = {
    ...splitRent.header.withholding_period_assignment,
    fiscal_year: 2026,
    quarter: 2,
    period_key: "2026-Q2",
    basis: "payment_date",
  }

  const q1Draft = buildModel115Draft({
    documents: [splitRent],
    fiscalYear: 2026,
    quarter: 1,
  })
  const q2Draft = buildModel115Draft({
    documents: [splitRent],
    fiscalYear: 2026,
    quarter: 2,
  })

  assert.deepEqual(q1Draft.documents_included, [])
  assert.deepEqual(q2Draft.documents_included, ["fd_q1_002"])
  assert.equal(q2Draft.rent_base_cents, 100000)
  assert.equal(q2Draft.withholding_cents, 19000)
})
