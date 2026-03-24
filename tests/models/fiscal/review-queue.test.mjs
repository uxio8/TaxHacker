import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  getFiscalReviewQueue,
  REVIEW_QUEUE_DRILLDOWN_BASE_PATH,
} from "../../../models/fiscal/review-queue.ts"

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

function buildRecordFromGoldenDocument(document) {
  return {
    id: document.document.header.fiscal_document_id,
    ownerScopeId: "fp_1",
    sourceTransactionId: document.document.header.source_transaction_id,
    documentKind: document.document.header.document_kind,
    issueDate: new Date(`${document.document.header.issue_date}T00:00:00.000Z`),
    counterpartyId: document.document.header.counterparty_id,
    counterpartyRole: document.document.header.counterparty_role,
    counterpartyName: document.document.header.counterparty_name,
    counterpartyTaxId: document.document.header.counterparty_tax_id,
    counterpartyCountryCode: document.document.header.counterparty_country_code,
    totalPayableCents: document.document.header.total_payable_cents,
    totalVatCents: document.document.header.total_vat_cents,
    totalWithholdingCents: document.document.header.total_withholding_cents,
    reviewStatus: document.expected.review.review_status,
    reviewReasons: document.expected.review.review_reasons,
    vatPeriodAssignment: document.document.header.vat_period_assignment,
    withholdingPeriodAssignment: document.document.header.withholding_period_assignment,
  }
}

test("getFiscalReviewQueue devuelve solo blocked y needs_review con trazabilidad y resumen", async () => {
  const blocked = buildRecordFromGoldenDocument(getGoldenDocument("payroll-placeholder-blocked"))
  const needsReview = buildRecordFromGoldenDocument(
    getGoldenDocument("received-missing-counterparty-relation")
  )
  const ready = buildRecordFromGoldenDocument(getGoldenDocument("received-office-supplies"))
  const calls = []

  const queue = await getFiscalReviewQueue(" fp_1 ", {
    transactionFiscal: {
      findMany: async (args) => {
        calls.push(args)
        return [needsReview, ready, blocked]
      },
    },
    fiscalReviewRequest: {
      findMany: async () => [],
    },
  })

  assert.deepEqual(calls, [
    {
      where: {
        ownerScopeId: "fp_1",
        reviewStatus: {
          in: ["needs_review", "blocked"],
        },
      },
      select: {
        id: true,
        ownerScopeId: true,
        sourceTransactionId: true,
        documentKind: true,
        issueDate: true,
        counterpartyId: true,
        counterpartyRole: true,
        counterpartyName: true,
        counterpartyTaxId: true,
        counterpartyCountryCode: true,
        totalPayableCents: true,
        totalVatCents: true,
        totalWithholdingCents: true,
        reviewStatus: true,
        reviewReasons: true,
        vatPeriodAssignment: true,
        withholdingPeriodAssignment: true,
      },
    },
  ])

  assert.deepEqual(queue.summary, {
    total: 1,
    blocked: 1,
    needs_review: 0,
  })

  assert.deepEqual(queue.items, [
    {
      fiscal_document_id: "fd_q1_007",
      source_transaction_id: "tx_q1_007",
      document_kind: "payroll_placeholder",
      issue_date: "2026-01-31",
      counterparty_name: "Nomina empleada 01",
      counterparty_tax_id: null,
      counterparty_country_code: "ES",
      counterparty_role: "employee",
      review_status: "blocked",
      review_reasons: ["employee_payroll_source_missing"],
      affected_obligation_codes: ["111_manual"],
      quarter: null,
      drilldown_href: `${REVIEW_QUEUE_DRILLDOWN_BASE_PATH}/tx_q1_007`,
      owner: "advisor",
      counterparty_resolution: null,
      active_request_count: 0,
      active_requests: [],
    },
  ])
})

test("getFiscalReviewQueue usa la asignacion de retencion cuando no existe trimestre de IVA", async () => {
  const rentDocument = getGoldenDocument("received-rent-withholding")
  const record = {
    ...buildRecordFromGoldenDocument(rentDocument),
    reviewStatus: "blocked",
    reviewReasons: ["missing_rent_withholding"],
    vatPeriodAssignment: null,
  }

  const queue = await getFiscalReviewQueue("fp_1", {
    transactionFiscal: {
      findMany: async () => [record],
    },
    fiscalReviewRequest: {
      findMany: async () => [],
    },
  })

  assert.deepEqual(queue.items[0]?.quarter, {
    fiscal_year: 2026,
    quarter: 1,
    period_key: "2026-Q1",
    basis: "manual_override",
  })
})

test("getFiscalReviewQueue falla si ownerScopeId viene vacio", async () => {
  await assert.rejects(() => getFiscalReviewQueue("   "), /ownerScopeId es obligatorio/)
})

test("getFiscalReviewQueue añade un resumen de resolución de contraparte cuando falta el vínculo canónico", async () => {
  const needsReview = {
    ...buildRecordFromGoldenDocument(getGoldenDocument("received-missing-counterparty-relation")),
    reviewStatus: "needs_review",
    reviewReasons: ["missing_counterparty_relation"],
  }

  const queue = await getFiscalReviewQueue("fp_1", {
    transactionFiscal: {
      findMany: async () => [needsReview],
    },
    fiscalReviewRequest: {
      findMany: async () => [],
    },
    counterparty: {
      findMany: async () => [
        {
          id: "cp_supply_1",
          ownerScopeId: "fp_1",
          displayName: "Suministros Luz Centro SA",
          normalizedName: "SUMINISTROS LUZ CENTRO SA",
          taxId: "A55667788",
          taxIdNormalized: "A55667788",
          canonicalIdentityKey: "ES:NIF:A55667788",
          identityBasis: "tax_id",
          countryCode: "ES",
          isActive: true,
        },
      ],
    },
  })

  assert.deepEqual(queue.items[0]?.counterparty_resolution, {
    decision: "auto_linked",
    active_candidate_count: 1,
    conflict_reason: null,
    suggested_candidate: {
      id: "cp_supply_1",
      display_name: "Suministros Luz Centro SA",
      tax_id: "A55667788",
      match_reasons: ["tax_id_exact", "name_exact"],
    },
  })
})

test("getFiscalReviewQueue no sugiere una contraparte segura cuando hay conflicto por NIF duplicado", async () => {
  const needsReview = {
    ...buildRecordFromGoldenDocument(getGoldenDocument("received-missing-counterparty-relation")),
    reviewStatus: "needs_review",
    reviewReasons: ["missing_counterparty_relation"],
  }

  const queue = await getFiscalReviewQueue("fp_1", {
    transactionFiscal: {
      findMany: async () => [needsReview],
    },
    fiscalReviewRequest: {
      findMany: async () => [],
    },
    counterparty: {
      findMany: async () => [
        {
          id: "cp_supply_1",
          ownerScopeId: "fp_1",
          displayName: "Suministros Luz Centro SA",
          normalizedName: "SUMINISTROS LUZ CENTRO SA",
          taxId: "A55667788",
          taxIdNormalized: "A55667788",
          canonicalIdentityKey: "ES:NIF:A55667788",
          identityBasis: "tax_id",
          countryCode: "ES",
          isActive: true,
        },
        {
          id: "cp_supply_2",
          ownerScopeId: "fp_1",
          displayName: "Suministros Luz Centro Dos SA",
          normalizedName: "SUMINISTROS LUZ CENTRO DOS SA",
          taxId: "A55667788",
          taxIdNormalized: "A55667788",
          canonicalIdentityKey: "ES:NIF:A55667788:DUP",
          identityBasis: "tax_id",
          countryCode: "ES",
          isActive: true,
        },
      ],
    },
  })

  assert.deepEqual(queue.items[0]?.counterparty_resolution, {
    decision: "needs_review_no_safe_candidate",
    active_candidate_count: 2,
    conflict_reason: "multiple_tax_id_candidates",
    suggested_candidate: null,
  })
})
