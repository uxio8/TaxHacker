import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  buildTransactionFiscalPanelDocumentInput,
  collectAffectedPeriodKeys,
} from "../../../app/(app)/transactions/fiscal-panel-shared.ts"

function loadGoldenQuarter() {
  return JSON.parse(
    readFileSync(new URL("../../fixtures/fiscal/golden-quarter.json", import.meta.url), "utf8")
  )
}

function getGoldenDocument(caseId) {
  const document = loadGoldenQuarter().documents.find((entry) => entry.case_id === caseId)

  assert.ok(document, `No existe el caso ${caseId} en el golden quarter`)
  return document.document
}

test("buildTransactionFiscalPanelDocumentInput aplica override manual de IVA", () => {
  const document = getGoldenDocument("received-office-supplies")

  const updated = buildTransactionFiscalPanelDocumentInput(document, {
    intent: "override_vat_manual",
    periodKey: "2026-Q2",
    vatCashAccountingEnabled: false,
    assignedAt: "2026-03-22T12:00:00.000Z",
  })

  assert.equal(updated.header.payment_date, null)
  assert.deepEqual(updated.header.vat_period_assignment, {
    fiscal_year: 2026,
    quarter: 2,
    period_key: "2026-Q2",
    basis: "manual_override",
    assigned_at: "2026-03-22T12:00:00.000Z",
  })
  assert.equal(updated.header.withholding_period_assignment, null)
})

test("buildTransactionFiscalPanelDocumentInput vuelve a automatico la retencion usando payment_date", () => {
  const document = getGoldenDocument("received-rent-withholding")

  const updated = buildTransactionFiscalPanelDocumentInput(
    {
      ...document,
      header: {
        ...document.header,
        payment_date: "2026-04-20",
        withholding_period_assignment: {
          fiscal_year: 2026,
          quarter: 1,
          period_key: "2026-Q1",
          basis: "manual_override",
          assigned_at: "2026-03-21T09:00:00.000Z",
        },
      },
    },
    {
      intent: "reset_withholding_automatic",
      vatCashAccountingEnabled: false,
      assignedAt: "2026-03-22T12:30:00.000Z",
    }
  )

  assert.deepEqual(updated.header.withholding_period_assignment, {
    fiscal_year: 2026,
    quarter: 2,
    period_key: "2026-Q2",
    basis: "payment_date",
    assigned_at: "2026-03-22T12:30:00.000Z",
  })
  assert.deepEqual(updated.header.vat_period_assignment, document.header.vat_period_assignment)
})

test("collectAffectedPeriodKeys une periodos actuales y futuros sin duplicados", () => {
  const currentDocument = getGoldenDocument("received-rent-withholding")
  const nextDocument = buildTransactionFiscalPanelDocumentInput(
    {
      ...currentDocument,
      header: {
        ...currentDocument.header,
        payment_date: "2026-04-20",
      },
    },
    {
      intent: "override_vat_manual",
      periodKey: "2026-Q2",
      vatCashAccountingEnabled: false,
      assignedAt: "2026-03-22T13:00:00.000Z",
    }
  )

  assert.deepEqual(collectAffectedPeriodKeys(currentDocument.header, nextDocument.header), [
    "2026-Q1",
    "2026-Q2",
  ])
})

test("buildTransactionFiscalPanelDocumentInput enlaza una contraparte existente", () => {
  const document = getGoldenDocument("received-missing-counterparty-relation")

  const updated = buildTransactionFiscalPanelDocumentInput(document, {
    intent: "link_counterparty",
    counterpartyId: "cp_supplier_001",
    vatCashAccountingEnabled: false,
    assignedAt: "2026-03-22T14:00:00.000Z",
  })

  assert.equal(updated.header.counterparty_id, "cp_supplier_001")
  assert.deepEqual(updated.header.vat_period_assignment, document.header.vat_period_assignment)
})

test("buildTransactionFiscalPanelDocumentInput mantiene el documento en revision sin tocar contraparte", () => {
  const document = getGoldenDocument("received-missing-counterparty-relation")

  const updated = buildTransactionFiscalPanelDocumentInput(document, {
    intent: "keep_counterparty_in_review",
    vatCashAccountingEnabled: false,
    assignedAt: "2026-03-22T14:30:00.000Z",
  })

  assert.equal(updated.header.counterparty_id, document.header.counterparty_id)
  assert.deepEqual(updated.header.vat_period_assignment, document.header.vat_period_assignment)
  assert.deepEqual(updated.header.withholding_period_assignment, document.header.withholding_period_assignment)
})
