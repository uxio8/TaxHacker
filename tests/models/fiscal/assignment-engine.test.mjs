import assert from "node:assert/strict"
import test from "node:test"

import { assignTransactionFiscalPeriodAssignments } from "../../../models/fiscal/assignment-engine.ts"

function createHeader(overrides = {}) {
  return {
    fiscal_document_id: "fd_assignment_1",
    source_transaction_id: "tx_assignment_1",
    document_kind: "received_invoice",
    direction: "incoming",
    invoice_number: "REC-2026-001",
    issue_date: "2026-01-15",
    operation_date: "2026-02-20",
    payment_date: null,
    currency_code: "EUR",
    counterparty_id: "cp_1",
    counterparty_role: "supplier",
    counterparty_name: "Proveedor Demo SL",
    counterparty_tax_id: "B12345678",
    counterparty_country_code: "ES",
    company_tax_id: "B11223344",
    total_net_cents: 100000,
    total_vat_cents: 21000,
    total_withholding_cents: 0,
    total_gross_cents: 121000,
    total_payable_cents: 121000,
    observed_amount_cents: 0,
    source_confidence: "manual",
    notes: null,
    vat_period_assignment: null,
    withholding_period_assignment: null,
    ...overrides,
  }
}

function createLine(overrides = {}) {
  return {
    line_id: "fd_assignment_1_l1",
    line_number: 1,
    concept: "Servicio demo",
    base_amount_cents: 100000,
    vat_treatment: "taxable",
    vat_rate_bps: 2100,
    vat_amount_cents: 21000,
    withholding_applicable: false,
    withholding_regime: "none",
    withholding_base_cents: 0,
    withholding_rate_bps: 0,
    withholding_amount_cents: 0,
    deductibility_percent_bps: 10000,
    deductibility_reason: "fully_deductible",
    expense_family: "services",
    ...overrides,
  }
}

test("assignTransactionFiscalPeriodAssignments prioriza manual_override sobre cualquier fecha", () => {
  const manualVatAssignment = {
    fiscal_year: 2026,
    quarter: 3,
    period_key: "2026-Q3",
    basis: "manual_override",
    assigned_at: "2026-03-21T09:00:00Z",
  }
  const manualWithholdingAssignment = {
    fiscal_year: 2026,
    quarter: 2,
    period_key: "2026-Q2",
    basis: "manual_override",
    assigned_at: "2026-03-21T09:05:00Z",
  }

  const assignments = assignTransactionFiscalPeriodAssignments(
    createHeader({
      payment_date: "2026-04-01",
      vat_period_assignment: manualVatAssignment,
      withholding_period_assignment: manualWithholdingAssignment,
    }),
    [
      createLine({
        withholding_applicable: true,
        withholding_regime: "rent",
        withholding_base_cents: 100000,
        withholding_rate_bps: 1900,
        withholding_amount_cents: 19000,
      }),
    ],
    {
      vatCashAccountingEnabled: true,
      assignedAt: "2026-03-22T10:00:00Z",
    }
  )

  assert.deepEqual(assignments, {
    vat_period_assignment: manualVatAssignment,
    withholding_period_assignment: manualWithholdingAssignment,
  })
})

test("assignTransactionFiscalPeriodAssignments usa payment_date para IVA en caja y siempre para retenciones", () => {
  const assignments = assignTransactionFiscalPeriodAssignments(
    createHeader({
      payment_date: "2026-04-01",
      total_withholding_cents: 19000,
      total_payable_cents: 102000,
    }),
    [
      createLine({
        concept: "Renta mensual",
        expense_family: "rent",
        withholding_applicable: true,
        withholding_regime: "rent",
        withholding_base_cents: 100000,
        withholding_rate_bps: 1900,
        withholding_amount_cents: 19000,
      }),
    ],
    {
      vatCashAccountingEnabled: true,
      assignedAt: "2026-03-22T10:00:00Z",
    }
  )

  assert.deepEqual(assignments, {
    vat_period_assignment: {
      fiscal_year: 2026,
      quarter: 2,
      period_key: "2026-Q2",
      basis: "payment_date",
      assigned_at: "2026-03-22T10:00:00Z",
    },
    withholding_period_assignment: {
      fiscal_year: 2026,
      quarter: 2,
      period_key: "2026-Q2",
      basis: "payment_date",
      assigned_at: "2026-03-22T10:00:00Z",
    },
  })
})

test("assignTransactionFiscalPeriodAssignments cae a operation_date para IVA y deja retenciones nulas sin payment_date", () => {
  const assignments = assignTransactionFiscalPeriodAssignments(
    createHeader({
      total_withholding_cents: 19000,
      total_payable_cents: 102000,
    }),
    [
      createLine({
        concept: "Renta mensual",
        expense_family: "rent",
        withholding_applicable: true,
        withholding_regime: "rent",
        withholding_base_cents: 100000,
        withholding_rate_bps: 1900,
        withholding_amount_cents: 19000,
      }),
    ],
    {
      vatCashAccountingEnabled: false,
      assignedAt: "2026-03-22T10:00:00Z",
    }
  )

  assert.deepEqual(assignments, {
    vat_period_assignment: {
      fiscal_year: 2026,
      quarter: 1,
      period_key: "2026-Q1",
      basis: "operation_date",
      assigned_at: "2026-03-22T10:00:00Z",
    },
    withholding_period_assignment: null,
  })
})

test("assignTransactionFiscalPeriodAssignments deja el IVA sin asignar en caja si falta payment_date", () => {
  const assignments = assignTransactionFiscalPeriodAssignments(
    createHeader(),
    [createLine()],
    {
      vatCashAccountingEnabled: true,
      assignedAt: "2026-03-22T10:00:00Z",
    }
  )

  assert.deepEqual(assignments, {
    vat_period_assignment: null,
    withholding_period_assignment: null,
  })
})
