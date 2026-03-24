import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { deriveTransactionFiscalReview } from "../../../models/fiscal/review-status.ts"

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

test("deriveTransactionFiscalReview replica expected.review para todo el golden dataset actual", async (context) => {
  const goldenQuarter = loadGoldenQuarter()

  for (const document of goldenQuarter.documents) {
    await context.test(document.case_id, () => {
      const review = deriveTransactionFiscalReview(document.document.header, document.document.lines)

      assert.deepEqual(
        {
          review_status: review.review_status,
          review_reasons: review.review_reasons,
          ready_line_ids_for_vat_books: review.ready_line_ids_for_vat_books,
          ready_line_ids_for_withholding_books: review.ready_line_ids_for_withholding_books,
        },
        document.expected.review
      )
    })
  }
})

test("deriveTransactionFiscalReview activa readiness de IVA y retención para alquiler con retención", () => {
  const golden = getGoldenDocument("received-rent-withholding")

  const review = deriveTransactionFiscalReview(golden.document.header, golden.document.lines)

  assert.equal(review.review_status, "ready")
  assert.deepEqual(review.ready_line_ids_for_vat_books, ["fd_q1_002_l1"])
  assert.deepEqual(review.ready_line_ids_for_withholding_books, ["fd_q1_002_l1"])
  assert.equal(review.lines[0]?.is_ready_for_vat_books, true)
  assert.equal(review.lines[0]?.is_ready_for_withholding_books, true)
})

test("deriveTransactionFiscalReview bloquea payroll_placeholder con motivo explicito", () => {
  const golden = getGoldenDocument("payroll-placeholder-blocked")

  const review = deriveTransactionFiscalReview(golden.document.header, golden.document.lines)

  assert.deepEqual(
    {
      review_status: review.review_status,
      review_reasons: review.review_reasons,
      ready_line_ids_for_vat_books: review.ready_line_ids_for_vat_books,
      ready_line_ids_for_withholding_books: review.ready_line_ids_for_withholding_books,
    },
    golden.expected.review
  )
  assert.equal(review.lines[0]?.is_ready_for_vat_books, false)
  assert.equal(review.lines[0]?.is_ready_for_withholding_books, false)
})

test("deriveTransactionFiscalReview mantiene needs_review en alquiler con retencion si falta counterparty_id", () => {
  const golden = getGoldenDocument("received-rent-withholding")

  const review = deriveTransactionFiscalReview(
    {
      ...golden.document.header,
      counterparty_id: null,
    },
    golden.document.lines
  )

  assert.equal(review.review_status, "needs_review")
  assert.deepEqual(review.review_reasons, ["missing_counterparty_relation"])
  assert.deepEqual(review.ready_line_ids_for_vat_books, [])
  assert.deepEqual(review.ready_line_ids_for_withholding_books, [])
})

test("deriveTransactionFiscalReview bloquea alquiler con retención si falta el NIF del arrendador", () => {
  const golden = getGoldenDocument("received-rent-withholding")

  const review = deriveTransactionFiscalReview(
    {
      ...golden.document.header,
      counterparty_tax_id: null,
    },
    golden.document.lines
  )

  assert.equal(review.review_status, "blocked")
  assert.deepEqual(review.review_reasons, ["missing_counterparty_tax_id"])
  assert.deepEqual(review.ready_line_ids_for_vat_books, [])
  assert.deepEqual(review.ready_line_ids_for_withholding_books, [])
})

test("deriveTransactionFiscalReview no bloquea una factura recibida completa solo por faltar counterparty_id", () => {
  const golden = getGoldenDocument("received-missing-counterparty-relation")

  const review = deriveTransactionFiscalReview(golden.document.header, golden.document.lines)

  assert.equal(review.review_status, "ready")
  assert.deepEqual(review.review_reasons, [])
  assert.deepEqual(review.ready_line_ids_for_vat_books, ["fd_q1_008_l1"])
  assert.equal(review.lines[0]?.is_ready_for_vat_books, true)
})

test("deriveTransactionFiscalReview bloquea cuando la cabecera no cuadra con la suma de lineas", () => {
  const golden = getGoldenDocument("received-office-supplies")
  const header = {
    ...golden.document.header,
    total_net_cents: golden.document.header.total_net_cents + 1,
  }

  const review = deriveTransactionFiscalReview(header, golden.document.lines)

  assert.equal(review.review_status, "blocked")
  assert.deepEqual(review.review_reasons, ["header_totals_mismatch"])
  assert.deepEqual(review.ready_line_ids_for_vat_books, [])
  assert.deepEqual(review.ready_line_ids_for_withholding_books, [])
})

test("deriveTransactionFiscalReview bloquea una factura emitida con deducibilidad positiva", () => {
  const golden = getGoldenDocument("issued-services-invoice")
  const lines = golden.document.lines.map((line) => ({
    ...line,
    deductibility_percent_bps: 10000,
    deductibility_reason: "fully_deductible",
  }))

  const review = deriveTransactionFiscalReview(golden.document.header, lines)

  assert.equal(review.review_status, "blocked")
  assert.deepEqual(review.review_reasons, ["manual_override_required"])
  assert.deepEqual(review.ready_line_ids_for_vat_books, [])
  assert.equal(review.lines[0]?.is_ready_for_vat_books, false)
})

test("deriveTransactionFiscalReview bloquea una linea taxable con base 0 y tipo 0", () => {
  const golden = getGoldenDocument("received-office-supplies")
  const lines = golden.document.lines.map((line) => ({
    ...line,
    base_amount_cents: 0,
    vat_rate_bps: 0,
    vat_amount_cents: 0,
  }))
  const header = {
    ...golden.document.header,
    total_net_cents: 0,
    total_vat_cents: 0,
    total_gross_cents: 0,
    total_payable_cents: 0,
  }

  const review = deriveTransactionFiscalReview(header, lines)

  assert.equal(review.review_status, "blocked")
  assert.deepEqual(review.review_reasons, ["missing_vat_breakdown"])
  assert.deepEqual(review.ready_line_ids_for_vat_books, [])
  assert.equal(review.lines[0]?.is_ready_for_vat_books, false)
})

test("deriveTransactionFiscalReview bloquea un documento sin issue_date antes de persistirlo", () => {
  const golden = getGoldenDocument("received-office-supplies")
  const header = {
    ...golden.document.header,
    issue_date: null,
  }

  const review = deriveTransactionFiscalReview(header, golden.document.lines)

  assert.equal(review.review_status, "blocked")
  assert.deepEqual(review.review_reasons, ["period_assignment_unclear"])
  assert.deepEqual(review.ready_line_ids_for_vat_books, [])
})

test("deriveTransactionFiscalReview bloquea retenciones dependientes de pago sin payment_date ni manual_override", () => {
  const golden = getGoldenDocument("received-rent-withholding")
  const header = {
    ...golden.document.header,
    withholding_period_assignment: null,
  }

  const review = deriveTransactionFiscalReview(
    header,
    golden.document.lines.map((line) => ({
      ...line,
      withholding_applicable: true,
      withholding_regime: "rent",
    }))
  )

  assert.equal(review.review_status, "blocked")
  assert.deepEqual(review.review_reasons, ["manual_override_required"])
  assert.deepEqual(review.header.vat_period_assignment, {
    fiscal_year: 2026,
    quarter: 1,
    period_key: "2026-Q1",
    basis: "issue_date",
    assigned_at: "2026-03-21T09:00:00Z",
  })
  assert.equal(review.header.withholding_period_assignment, null)
  assert.deepEqual(review.ready_line_ids_for_vat_books, ["fd_q1_002_l1"])
  assert.deepEqual(review.ready_line_ids_for_withholding_books, [])
  assert.equal(review.lines[0]?.is_ready_for_vat_books, true)
  assert.equal(review.lines[0]?.is_ready_for_withholding_books, false)
})

test("deriveTransactionFiscalReview usa payment_date para IVA cuando el perfil fiscal está en criterio de caja", () => {
  const golden = getGoldenDocument("received-office-supplies")
  const review = deriveTransactionFiscalReview(
    {
      ...golden.document.header,
      vat_period_assignment: null,
      payment_date: "2026-04-01",
    },
    golden.document.lines,
    {
      vatCashAccountingEnabled: true,
      assignedAt: "2026-03-22T10:00:00Z",
    }
  )

  assert.equal(review.review_status, "ready")
  assert.deepEqual(review.header.vat_period_assignment, {
    fiscal_year: 2026,
    quarter: 2,
    period_key: "2026-Q2",
    basis: "payment_date",
    assigned_at: "2026-03-22T10:00:00Z",
  })
  assert.deepEqual(review.ready_line_ids_for_vat_books, ["fd_q1_001_l1"])
})

test("deriveTransactionFiscalReview separa IVA y retención en trimestres distintos cuando solo la retención depende del cobro", () => {
  const golden = getGoldenDocument("received-rent-withholding")
  const review = deriveTransactionFiscalReview(
    {
      ...golden.document.header,
      vat_period_assignment: null,
      withholding_period_assignment: null,
      issue_date: "2026-01-15",
      operation_date: null,
      payment_date: "2026-04-20",
    },
    golden.document.lines,
    {
      vatCashAccountingEnabled: false,
      assignedAt: "2026-03-22T10:00:00Z",
    }
  )

  assert.equal(review.review_status, "ready")
  assert.deepEqual(review.header.vat_period_assignment, {
    fiscal_year: 2026,
    quarter: 1,
    period_key: "2026-Q1",
    basis: "issue_date",
    assigned_at: "2026-03-22T10:00:00Z",
  })
  assert.deepEqual(review.header.withholding_period_assignment, {
    fiscal_year: 2026,
    quarter: 2,
    period_key: "2026-Q2",
    basis: "payment_date",
    assigned_at: "2026-03-22T10:00:00Z",
  })
  assert.deepEqual(review.ready_line_ids_for_vat_books, ["fd_q1_002_l1"])
  assert.deepEqual(review.ready_line_ids_for_withholding_books, ["fd_q1_002_l1"])
})

test("deriveTransactionFiscalReview respeta manual_override de retenciones sin payment_date", () => {
  const golden = getGoldenDocument("received-rent-withholding")
  const review = deriveTransactionFiscalReview(
    {
      ...golden.document.header,
      vat_period_assignment: null,
      payment_date: null,
      withholding_period_assignment: {
        fiscal_year: 2026,
        quarter: 2,
        period_key: "2026-Q2",
        basis: "manual_override",
        assigned_at: "2026-03-22T10:00:00Z",
      },
    },
    golden.document.lines,
    {
      vatCashAccountingEnabled: false,
      assignedAt: "2026-03-22T10:00:00Z",
    }
  )

  assert.equal(review.review_status, "ready")
  assert.deepEqual(review.header.vat_period_assignment, {
    fiscal_year: 2026,
    quarter: 1,
    period_key: "2026-Q1",
    basis: "issue_date",
    assigned_at: "2026-03-22T10:00:00Z",
  })
  assert.deepEqual(review.header.withholding_period_assignment, {
    fiscal_year: 2026,
    quarter: 2,
    period_key: "2026-Q2",
    basis: "manual_override",
    assigned_at: "2026-03-22T10:00:00Z",
  })
  assert.deepEqual(review.ready_line_ids_for_withholding_books, ["fd_q1_002_l1"])
})

test("deriveTransactionFiscalReview fuerza revision de IVA en criterio de caja si falta payment_date", () => {
  const golden = getGoldenDocument("received-office-supplies")
  const review = deriveTransactionFiscalReview(
    {
      ...golden.document.header,
      vat_period_assignment: null,
      payment_date: null,
    },
    golden.document.lines,
    {
      vatCashAccountingEnabled: true,
      assignedAt: "2026-03-22T10:00:00Z",
    }
  )

  assert.equal(review.review_status, "blocked")
  assert.deepEqual(review.review_reasons, ["period_assignment_unclear"])
  assert.equal(review.header.vat_period_assignment, null)
  assert.deepEqual(review.ready_line_ids_for_vat_books, [])
})
