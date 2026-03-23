import assert from "node:assert/strict"
import test from "node:test"

import {
  buildAnnualHandoffPack,
  resolveAnnualHandoffFiscalYear,
} from "../../../models/fiscal/annual-handoff.ts"

function createProfile(overrides = {}) {
  return {
    id: "fp_demo",
    organizationId: "org_demo",
    companyName: "Demo SL",
    taxId: "B12345678",
    annualCloseMonth: 12,
    hasEmployees: false,
    hasRentWithholding: false,
    hasProfessionalWithholding: false,
    hasIntraEuOperations: false,
    issuesInvoices: true,
    ...overrides,
  }
}

function createObligation(overrides = {}) {
  return {
    id: "obl_demo",
    organizationId: "org_demo",
    ownerScopeId: "fp_demo",
    code: "200_handoff",
    fiscalYear: 2025,
    quarter: null,
    periodKey: "2025-Y",
    status: "waiting_on_documents",
    dueDate: new Date("2026-07-25T00:00:00.000Z"),
    owner: "advisor",
    blockingReasons: [],
    requiredEvidence: ["draft_export", "filing_receipt"],
    filingReference: null,
    filedAt: null,
    filedByUserId: null,
    notes: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  }
}

test("resolveAnnualHandoffFiscalYear apunta al ultimo ejercicio cerrado segun la fecha de referencia", () => {
  assert.equal(
    resolveAnnualHandoffFiscalYear({
      annualCloseMonth: 12,
      referenceDate: new Date("2026-03-23T10:00:00.000Z"),
    }),
    2025
  )

  assert.equal(
    resolveAnnualHandoffFiscalYear({
      annualCloseMonth: 6,
      referenceDate: new Date("2026-09-01T10:00:00.000Z"),
    }),
    2026
  )
})

test("buildAnnualHandoffPack crea un paquete ligero de seguimiento sin prometer automatizacion contable", () => {
  const pack = buildAnnualHandoffPack({
    fiscalYear: 2025,
    profile: createProfile(),
    obligations: [
      createObligation(),
      createObligation({
        id: "obl_202",
        code: "202_handoff",
        dueDate: new Date("2025-12-20T00:00:00.000Z"),
        status: "draft_ready",
        requiredEvidence: ["draft_export"],
      }),
    ],
  })

  assert.equal(pack.fiscalYear, 2025)
  assert.equal(pack.automationMode, "handoff_only")
  assert.equal(pack.summary.totalItems, 5)
  assert.equal(pack.summary.readyOrFiledItems, 1)
  assert.equal(pack.summary.blockedItems, 0)
  assert.deepEqual(
    pack.items.map((item) => item.code),
    ["202_handoff", "annual_accounts", "book_legalization", "200_handoff", "mercantile_filing"]
  )
  assert.deepEqual(pack.items.find((item) => item.code === "200_handoff"), {
    code: "200_handoff",
    title: "Impuesto sobre Sociedades",
    kind: "tax",
    status: "waiting_on_documents",
    owner: "advisor",
    dueDate: "2026-07-25",
    requiredEvidence: ["draft_export", "filing_receipt"],
    blockingReasons: [],
    notes: "Seguimiento anual y handoff a contabilidad o asesoria externa. Sin calculo automatico.",
    trackingNotes: null,
  })
  assert.equal(
    pack.items.find((item) => item.code === "annual_accounts")?.dueDate,
    "2026-03-31"
  )
  assert.equal(
    pack.items.find((item) => item.code === "mercantile_filing")?.dueDate,
    "2026-07-31"
  )
  assert.equal(
    pack.items.find((item) => item.code === "book_legalization")?.dueDate,
    "2026-04-30"
  )
})
