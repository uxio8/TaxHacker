import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  buildModel303Draft,
  MODEL_303_DRILLDOWN_BASE_PATH,
} from "../../../models/tax-forms/model-303.ts"

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

function serializeTrace(trace) {
  return {
    output_vat_by_rate: Object.fromEntries(
      Object.entries(trace.output_vat_by_rate).map(([rate, lines]) => [
        rate,
        lines.map((line) => ({
          fiscal_document_id: line.fiscal_document_id,
          line_id: line.line_id,
          source_transaction_id: line.source_transaction_id,
          source_transaction_href: line.source_transaction_href,
        })),
      ])
    ),
    input_vat_deductible_by_rate: Object.fromEntries(
      Object.entries(trace.input_vat_deductible_by_rate).map(([rate, lines]) => [
        rate,
        lines.map((line) => ({
          fiscal_document_id: line.fiscal_document_id,
          line_id: line.line_id,
          source_transaction_id: line.source_transaction_id,
          source_transaction_href: line.source_transaction_href,
        })),
      ])
    ),
    input_vat_non_deductible_by_rate: Object.fromEntries(
      Object.entries(trace.input_vat_non_deductible_by_rate).map(([rate, lines]) => [
        rate,
        lines.map((line) => ({
          fiscal_document_id: line.fiscal_document_id,
          line_id: line.line_id,
          source_transaction_id: line.source_transaction_id,
          source_transaction_href: line.source_transaction_href,
        })),
      ])
    ),
  }
}

function cloneDocument(document, overrides = {}) {
  return {
    header: {
      ...document.header,
      ...overrides.header,
    },
    lines: document.lines.map((line, index) => ({
      ...line,
      fiscal_document_id:
        overrides.header?.fiscal_document_id ?? document.header.fiscal_document_id,
      line_id:
        overrides.lineIds?.[index] ??
        `${overrides.header?.fiscal_document_id ?? document.header.fiscal_document_id}_l${index + 1}`,
      ...(overrides.lines?.[index] ?? {}),
    })),
  }
}

test("buildModel303Draft reproduce el oracle trimestral y conserva trazabilidad por linea origen", () => {
  const goldenQuarter = loadGoldenQuarter()
  const documents = [...goldenQuarter.documents].reverse().map((entry) => entry.document)

  const draft = buildModel303Draft(documents, goldenQuarter.quarter.period_key)

  assert.deepEqual(
    {
      documents_included: draft.documents_included,
      output_vat_by_rate: draft.output_vat_by_rate,
      input_vat_deductible_by_rate: draft.input_vat_deductible_by_rate,
      input_vat_non_deductible_by_rate: draft.input_vat_non_deductible_by_rate,
      output_vat_total_cents: draft.output_vat_total_cents,
      input_vat_deductible_total_cents: draft.input_vat_deductible_total_cents,
      result_vat_payable_cents: draft.result_vat_payable_cents,
    },
    goldenQuarter.expected_quarter.model_303
  )

  assert.deepEqual(serializeTrace(draft.trace), {
    output_vat_by_rate: {
      2100: [
        {
          fiscal_document_id: "fd_q1_003",
          line_id: "fd_q1_003_l1",
          source_transaction_id: "tx_q1_003",
          source_transaction_href: `${MODEL_303_DRILLDOWN_BASE_PATH}/tx_q1_003`,
        },
      ],
      1000: [],
      400: [],
    },
    input_vat_deductible_by_rate: {
      2100: [
        {
          fiscal_document_id: "fd_q1_001",
          line_id: "fd_q1_001_l1",
          source_transaction_id: "tx_q1_001",
          source_transaction_href: `${MODEL_303_DRILLDOWN_BASE_PATH}/tx_q1_001`,
        },
        {
          fiscal_document_id: "fd_q1_002",
          line_id: "fd_q1_002_l1",
          source_transaction_id: "tx_q1_002",
          source_transaction_href: `${MODEL_303_DRILLDOWN_BASE_PATH}/tx_q1_002`,
        },
        {
          fiscal_document_id: "fd_q1_005",
          line_id: "fd_q1_005_l1",
          source_transaction_id: "tx_q1_005",
          source_transaction_href: `${MODEL_303_DRILLDOWN_BASE_PATH}/tx_q1_005`,
        },
        {
          fiscal_document_id: "fd_q1_006",
          line_id: "fd_q1_006_l1",
          source_transaction_id: "tx_q1_006",
          source_transaction_href: `${MODEL_303_DRILLDOWN_BASE_PATH}/tx_q1_006`,
        },
        {
          fiscal_document_id: "fd_q1_008",
          line_id: "fd_q1_008_l1",
          source_transaction_id: "tx_q1_008",
          source_transaction_href: `${MODEL_303_DRILLDOWN_BASE_PATH}/tx_q1_008`,
        },
      ],
      1000: [],
      400: [
        {
          fiscal_document_id: "fd_q1_005",
          line_id: "fd_q1_005_l2",
          source_transaction_id: "tx_q1_005",
          source_transaction_href: `${MODEL_303_DRILLDOWN_BASE_PATH}/tx_q1_005`,
        },
      ],
    },
    input_vat_non_deductible_by_rate: {
      2100: [],
      1000: [
        {
          fiscal_document_id: "fd_q1_004",
          line_id: "fd_q1_004_l1",
          source_transaction_id: "tx_q1_004",
          source_transaction_href: `${MODEL_303_DRILLDOWN_BASE_PATH}/tx_q1_004`,
        },
        {
          fiscal_document_id: "fd_q1_006",
          line_id: "fd_q1_006_l2",
          source_transaction_id: "tx_q1_006",
          source_transaction_href: `${MODEL_303_DRILLDOWN_BASE_PATH}/tx_q1_006`,
        },
      ],
      400: [],
    },
  })
})

test("buildModel303Draft filtra por trimestre de IVA y readiness sin usar la asignacion de retencion como proxy", () => {
  const ready = getGoldenDocument("received-office-supplies").document
  const rent = getGoldenDocument("received-rent-withholding").document

  const notReady = cloneDocument(ready, {
    header: {
      fiscal_document_id: "fd_q1_not_ready",
      source_transaction_id: "tx_q1_not_ready",
      invoice_number: "REC-2026-NR",
    },
    lines: [
      {
        is_ready_for_vat_books: false,
      },
    ],
  })
  const offQuarter = cloneDocument(ready, {
    header: {
      fiscal_document_id: "fd_q2_off_quarter",
      source_transaction_id: "tx_q2_off_quarter",
      issue_date: "2026-04-01",
      invoice_number: "REC-2026-Q2",
      vat_period_assignment: {
        ...ready.header.vat_period_assignment,
        fiscal_year: 2026,
        quarter: 2,
        period_key: "2026-Q2",
      },
    },
  })
  const withholdingOnly = cloneDocument(rent, {
    header: {
      fiscal_document_id: "fd_q1_withholding_only",
      source_transaction_id: "tx_q1_withholding_only",
      invoice_number: "ALQ-2026-WO",
      vat_period_assignment: null,
    },
  })

  const draft = buildModel303Draft(
    [withholdingOnly, offQuarter, notReady, ready],
    "2026-Q1"
  )

  assert.deepEqual(draft.documents_included, ["fd_q1_001"])
  assert.equal(draft.output_vat_total_cents, 0)
  assert.equal(draft.input_vat_deductible_total_cents, 2100)
  assert.equal(draft.result_vat_payable_cents, -2100)
})

test("buildModel303Draft falla si aparece un tipo de IVA no soportado en una linea lista para libros", () => {
  const ready = getGoldenDocument("received-office-supplies").document
  const unsupported = cloneDocument(ready, {
    header: {
      fiscal_document_id: "fd_q1_unsupported_rate",
      source_transaction_id: "tx_q1_unsupported_rate",
      invoice_number: "REC-2026-500",
    },
    lines: [
      {
        vat_rate_bps: 500,
        vat_amount_cents: 500,
      },
    ],
  })

  assert.throws(
    () => buildModel303Draft([unsupported], "2026-Q1"),
    /Model 303 V1 no admite vat_rate_bps=500/
  )
})

test("buildModel303Draft mantiene el IVA en su trimestre aunque la retencion del mismo documento vaya a otro", () => {
  const splitRent = structuredClone(getGoldenDocument("received-rent-withholding").document)

  splitRent.header.withholding_period_assignment = {
    ...splitRent.header.withholding_period_assignment,
    fiscal_year: 2026,
    quarter: 2,
    period_key: "2026-Q2",
    basis: "payment_date",
  }

  const q1Draft = buildModel303Draft([splitRent], "2026-Q1")
  const q2Draft = buildModel303Draft([splitRent], "2026-Q2")

  assert.deepEqual(q1Draft.documents_included, ["fd_q1_002"])
  assert.deepEqual(q2Draft.documents_included, [])
})
