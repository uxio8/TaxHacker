import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  FISCAL_PERIOD_STATUS_OPEN,
  buildFiscalPeriodKey,
  buildFiscalQuarterBounds,
} from "../../../models/fiscal/periods.ts"
import {
  buildQuarterlyDraft,
  getQuarterlyDraftByPeriodKey,
  listQuarterlyDrafts,
} from "../../../models/fiscal/quarterly-draft.ts"

function loadGoldenQuarter() {
  return JSON.parse(
    readFileSync(new URL("../../fixtures/fiscal/golden-quarter.json", import.meta.url), "utf8")
  )
}

function createFiscalPeriodFromGolden(goldenQuarter) {
  const periodKey = buildFiscalPeriodKey(goldenQuarter.fiscal_year, goldenQuarter.quarter)
  const bounds = buildFiscalQuarterBounds(goldenQuarter.fiscal_year, goldenQuarter.quarter)

  return {
    id: `period_${periodKey.toLowerCase()}`,
    ownerScopeId: "fp_demo",
    fiscalYear: goldenQuarter.fiscal_year,
    quarter: goldenQuarter.quarter,
    periodKey,
    startsOn: bounds.startsOn.toISOString().slice(0, 10),
    endsOn: bounds.endsOn.toISOString().slice(0, 10),
    status: FISCAL_PERIOD_STATUS_OPEN,
    countryCode: "ES",
    currencyCode: "EUR",
    createdAt: "2026-03-21T09:00:00.000Z",
    updatedAt: "2026-03-21T09:00:00.000Z",
  }
}

function getGoldenDocument(caseId) {
  const document = loadGoldenQuarter().documents.find((entry) => entry.case_id === caseId)

  assert.ok(document, `No existe el caso ${caseId} en el golden quarter`)
  return document
}

function createFiscalPeriodRecordFromGolden(goldenQuarter) {
  const period = createFiscalPeriodFromGolden(goldenQuarter)

  return {
    id: period.id,
    ownerScopeId: period.ownerScopeId,
    fiscalYear: period.fiscalYear,
    quarter: period.quarter,
    periodKey: period.periodKey,
    startsOn: new Date(`${period.startsOn}T00:00:00.000Z`),
    endsOn: new Date(`${period.endsOn}T00:00:00.000Z`),
    status: period.status,
    countryCode: period.countryCode,
    currencyCode: period.currencyCode,
    createdAt: new Date(period.createdAt),
    updatedAt: new Date(period.updatedAt),
  }
}

function createTransactionFiscalRecordFromDocument(document, ownerScopeId) {
  return {
    id: document.header.fiscal_document_id,
    ownerScopeId,
    sourceTransactionId: document.header.source_transaction_id,
    documentKind: document.header.document_kind,
    direction: document.header.direction,
    invoiceNumber: document.header.invoice_number,
    invoiceSeries: document.header.invoice_series,
    issueDate: new Date(`${document.header.issue_date}T00:00:00.000Z`),
    operationDate: document.header.operation_date
      ? new Date(`${document.header.operation_date}T00:00:00.000Z`)
      : null,
    paymentDate: document.header.payment_date
      ? new Date(`${document.header.payment_date}T00:00:00.000Z`)
      : null,
    currencyCode: document.header.currency_code,
    counterpartyId: document.header.counterparty_id,
    counterpartyRole: document.header.counterparty_role,
    counterpartyName: document.header.counterparty_name,
    counterpartyTaxId: document.header.counterparty_tax_id,
    counterpartyCountryCode: document.header.counterparty_country_code,
    companyTaxId: document.header.company_tax_id,
    reviewStatus: document.header.review_status,
    reviewReasons: document.header.review_reasons,
    vatPeriodAssignment: document.header.vat_period_assignment,
    withholdingPeriodAssignment: document.header.withholding_period_assignment,
    observedAmountCents: document.header.observed_amount_cents,
    totalNetCents: document.header.total_net_cents,
    totalVatCents: document.header.total_vat_cents,
    totalWithholdingCents: document.header.total_withholding_cents,
    totalGrossCents: document.header.total_gross_cents,
    totalPayableCents: document.header.total_payable_cents,
    sourceConfidence: document.header.source_confidence,
    notes: document.header.notes,
    lines: document.lines.map((line) => ({
      id: line.line_id,
      transactionFiscalId: line.fiscal_document_id,
      lineNumber: line.line_number,
      concept: line.concept,
      baseAmountCents: line.base_amount_cents,
      vatTreatment: line.vat_treatment,
      vatRateBps: line.vat_rate_bps,
      vatAmountCents: line.vat_amount_cents,
      withholdingApplicable: line.withholding_applicable,
      withholdingRegime: line.withholding_regime,
      withholdingBaseCents: line.withholding_base_cents,
      withholdingRateBps: line.withholding_rate_bps,
      withholdingAmountCents: line.withholding_amount_cents,
      deductibilityPercentBps: line.deductibility_percent_bps,
      deductibilityReason: line.deductibility_reason,
      expenseFamily: line.expense_family,
      isReadyForVatBooks: line.is_ready_for_vat_books,
      isReadyForWithholdingBooks: line.is_ready_for_withholding_books,
    })),
  }
}

function createQuarterlyDraftStoreFromGolden(goldenQuarter) {
  const ownerScopeId = "fp_demo"
  const periodRecord = createFiscalPeriodRecordFromGolden(goldenQuarter.quarter)
  const documentRecords = goldenQuarter.documents.map((entry) =>
    createTransactionFiscalRecordFromDocument(entry.document, ownerScopeId)
  )
  const periodRecords = new Map([[`${ownerScopeId}:${periodRecord.periodKey}`, periodRecord]])

  return {
    fiscalPeriod: {
      async findMany() {
        return Array.from(periodRecords.values()).sort((left, right) => {
          if (left.fiscalYear !== right.fiscalYear) {
            return right.fiscalYear - left.fiscalYear
          }

          return right.quarter - left.quarter
        })
      },
      async findUnique(args) {
        const periodKey = args.where.ownerScopeId_periodKey.periodKey
        return periodRecords.get(`${ownerScopeId}:${periodKey}`) ?? null
      },
      async upsert(args) {
        const lookup = args.where.ownerScopeId_periodKey
        const key = `${lookup.ownerScopeId}:${lookup.periodKey}`
        const existing = periodRecords.get(key)
        const nextRecord = existing
          ? {
              ...existing,
              ...args.update,
            }
          : {
              id: `period_${lookup.periodKey.toLowerCase()}`,
              ownerScopeId: lookup.ownerScopeId,
              fiscalYear: args.create.fiscalYear,
              quarter: args.create.quarter,
              periodKey: args.create.periodKey,
              startsOn: args.create.startsOn,
              endsOn: args.create.endsOn,
              status: args.create.status,
              countryCode: args.create.countryCode,
              currencyCode: args.create.currencyCode,
              createdAt: new Date("2026-03-22T09:00:00.000Z"),
              updatedAt: new Date("2026-03-22T09:00:00.000Z"),
            }

        periodRecords.set(key, nextRecord)
        return nextRecord
      },
    },
    transactionFiscal: {
      async findMany() {
        return documentRecords
      },
    },
  }
}

test("buildQuarterlyDraft reproduce el agregado operativo del golden quarter", () => {
  const goldenQuarter = loadGoldenQuarter()
  const period = createFiscalPeriodFromGolden(goldenQuarter.quarter)

  const draft = buildQuarterlyDraft(
    period,
    goldenQuarter.documents.map((entry) => entry.document)
  )

  assert.deepEqual(draft.reviewStatusCounts, {
    ready: 7,
    needs_review: 0,
    blocked: 0,
    pending: 0,
  })
  assert.equal(draft.operationalStatus.code, "ready")
  assert.equal(draft.totals.documentCount, goldenQuarter.documents.length - 1)
  assert.equal(draft.totals.model303DocumentCount, goldenQuarter.expected_quarter.model_303.documents_included.length)
  assert.equal(draft.totals.model115DocumentCount, goldenQuarter.expected_quarter.model_115.documents_included.length)
  assert.deepEqual(draft.model303DocumentIds, goldenQuarter.expected_quarter.model_303.documents_included)
  assert.deepEqual(draft.model115DocumentIds, goldenQuarter.expected_quarter.model_115.documents_included)
  assert.deepEqual(draft.reviewStatusTotals.ready, {
    reviewStatus: "ready",
    documentCount: 7,
    observedAmountCents: 0,
    totalNetCents: 415000,
    totalVatCents: 82580,
    totalWithholdingCents: 19000,
    totalGrossCents: 497580,
    totalPayableCents: 478580,
  })
  assert.deepEqual(draft.reviewStatusTotals.needs_review, {
    reviewStatus: "needs_review",
    documentCount: 0,
    observedAmountCents: 0,
    totalNetCents: 0,
    totalVatCents: 0,
    totalWithholdingCents: 0,
    totalGrossCents: 0,
    totalPayableCents: 0,
  })
  assert.deepEqual(draft.reviewStatusTotals.blocked, {
    reviewStatus: "blocked",
    documentCount: 0,
    observedAmountCents: 0,
    totalNetCents: 0,
    totalVatCents: 0,
    totalWithholdingCents: 0,
    totalGrossCents: 0,
    totalPayableCents: 0,
  })
  assert.deepEqual(draft.totals, {
    documentCount: 7,
    observedAmountCents: 0,
    totalNetCents: 415000,
    totalVatCents: 82580,
    totalWithholdingCents: 19000,
    totalGrossCents: 497580,
    totalPayableCents: 478580,
    model303DocumentCount: 7,
    model115DocumentCount: 1,
  })

  const payrollPlaceholder = draft.documents.find((document) => document.fiscalDocumentId === "fd_q1_007")

  assert.equal(payrollPlaceholder, undefined)
})

test("buildQuarterlyDraft da prioridad a una asignacion explicita a otro trimestre sin reintroducir fallback por fecha", () => {
  const goldenQuarter = loadGoldenQuarter()
  const period = createFiscalPeriodFromGolden(goldenQuarter.quarter)
  const documents = goldenQuarter.documents.map((entry) => ({
    header: {
      ...entry.document.header,
    },
    lines: entry.document.lines.map((line) => ({
      ...line,
    })),
  }))

  const officeSupplies = documents.find((document) => document.header.fiscal_document_id === "fd_q1_001")
  assert.ok(officeSupplies)
  officeSupplies.header.vat_period_assignment = {
    ...officeSupplies.header.vat_period_assignment,
    fiscal_year: 2026,
    quarter: 2,
    period_key: "2026-Q2",
  }

  const draft = buildQuarterlyDraft(period, documents)

  assert.equal(draft.totals.documentCount, goldenQuarter.documents.length - 2)
  assert.deepEqual(draft.reviewStatusCounts, {
    ready: 6,
    needs_review: 0,
    blocked: 0,
    pending: 0,
  })
  assert.equal(draft.documents.some((document) => document.fiscalDocumentId === "fd_q1_001"), false)
  assert.equal(draft.documents.some((document) => document.fiscalDocumentId === "fd_q1_007"), false)
})

test("buildQuarterlyDraft excluye documentos sin asignacion persistida aunque su fecha caiga dentro del trimestre", () => {
  const period = createFiscalPeriodFromGolden(loadGoldenQuarter().quarter)
  const unassignedDocument = structuredClone(getGoldenDocument("received-office-supplies").document)

  unassignedDocument.header.vat_period_assignment = null
  unassignedDocument.header.withholding_period_assignment = null
  unassignedDocument.header.review_status = "needs_review"
  unassignedDocument.header.review_reasons = ["period_assignment_unclear"]

  const draft = buildQuarterlyDraft(period, [unassignedDocument])

  assert.equal(draft.totals.documentCount, 0)
  assert.deepEqual(draft.documents, [])
  assert.deepEqual(draft.model303DocumentIds, [])
  assert.deepEqual(draft.model115DocumentIds, [])
})

test("buildQuarterlyDraft permite partir un mismo documento entre IVA y retencion en trimestres distintos", () => {
  const q1Period = createFiscalPeriodFromGolden(loadGoldenQuarter().quarter)
  const q2Period = createFiscalPeriodFromGolden({ fiscal_year: 2026, quarter: 2 })
  const splitDocument = structuredClone(getGoldenDocument("received-rent-withholding").document)

  splitDocument.header.withholding_period_assignment = {
    ...splitDocument.header.withholding_period_assignment,
    fiscal_year: 2026,
    quarter: 2,
    period_key: "2026-Q2",
    basis: "payment_date",
  }

  const q1Draft = buildQuarterlyDraft(q1Period, [splitDocument])
  const q2Draft = buildQuarterlyDraft(q2Period, [splitDocument])

  assert.deepEqual(q1Draft.model303DocumentIds, ["fd_q1_002"])
  assert.deepEqual(q1Draft.model115DocumentIds, [])
  assert.deepEqual(q1Draft.documents, [
    {
      fiscalDocumentId: "fd_q1_002",
      sourceTransactionId: "tx_q1_002",
      issueDate: "2026-02-01",
      invoiceNumber: "ALQ-2026-02",
      counterpartyName: "Inmuebles Gran Via SL",
      counterpartyTaxId: "B76543210",
      reviewStatus: "ready",
      reviewReasons: [],
      observedAmountCents: 0,
      totalNetCents: 100000,
      totalVatCents: 21000,
      totalWithholdingCents: 19000,
      totalGrossCents: 121000,
      totalPayableCents: 102000,
      includesVat: true,
      includesWithholding: false,
      transactionHref: "/transactions/tx_q1_002",
      factHref: "/tax/quarters/2026-Q1#fact-fd_q1_002",
    },
  ])

  assert.deepEqual(q2Draft.model303DocumentIds, [])
  assert.deepEqual(q2Draft.model115DocumentIds, ["fd_q1_002"])
  assert.deepEqual(q2Draft.documents, [
    {
      fiscalDocumentId: "fd_q1_002",
      sourceTransactionId: "tx_q1_002",
      issueDate: "2026-02-01",
      invoiceNumber: "ALQ-2026-02",
      counterpartyName: "Inmuebles Gran Via SL",
      counterpartyTaxId: "B76543210",
      reviewStatus: "ready",
      reviewReasons: [],
      observedAmountCents: 0,
      totalNetCents: 100000,
      totalVatCents: 21000,
      totalWithholdingCents: 19000,
      totalGrossCents: 121000,
      totalPayableCents: 102000,
      includesVat: false,
      includesWithholding: true,
      transactionHref: "/transactions/tx_q1_002",
      factHref: "/tax/quarters/2026-Q2#fact-fd_q1_002",
    },
  ])
})

test("buildQuarterlyDraft mantiene el documento en el 303 del trimestre cuando solo falla la retencion por falta de payment_date", () => {
  const period = createFiscalPeriodFromGolden(loadGoldenQuarter().quarter)
  const blockedRent = structuredClone(getGoldenDocument("received-rent-withholding").document)

  blockedRent.header.review_status = "blocked"
  blockedRent.header.review_reasons = ["manual_override_required"]
  blockedRent.header.withholding_period_assignment = null
  blockedRent.header.payment_date = null
  blockedRent.lines = blockedRent.lines.map((line) => ({
    ...line,
    is_ready_for_vat_books: true,
    is_ready_for_withholding_books: false,
  }))

  const draft = buildQuarterlyDraft(period, [blockedRent])

  assert.deepEqual(draft.model303DocumentIds, ["fd_q1_002"])
  assert.deepEqual(draft.model115DocumentIds, [])
  assert.equal(draft.documents[0]?.reviewStatus, "blocked")
  assert.deepEqual(draft.documents[0]?.reviewReasons, ["manual_override_required"])
})

test("listQuarterlyDrafts usa un store tipo Prisma directo y completa el set trimestral por defecto", async () => {
  const goldenQuarter = loadGoldenQuarter()
  const drafts = await listQuarterlyDrafts("fp_demo", createQuarterlyDraftStoreFromGolden(goldenQuarter))

  assert.equal(drafts.length, 8)
  assert.equal(drafts.some((draft) => draft.period.periodKey === "2026-Q1"), true)
  assert.equal(
    drafts.find((draft) => draft.period.periodKey === "2026-Q1")?.totals.documentCount,
    goldenQuarter.documents.length - 1
  )
})

test("getQuarterlyDraftByPeriodKey resuelve un trimestre concreto con un store tipo Prisma directo", async () => {
  const goldenQuarter = loadGoldenQuarter()
  const draft = await getQuarterlyDraftByPeriodKey(
    "fp_demo",
    "2026-Q1",
    createQuarterlyDraftStoreFromGolden(goldenQuarter)
  )

  assert.ok(draft)
  assert.equal(draft.period.periodKey, "2026-Q1")
  assert.equal(draft.documents.length, goldenQuarter.documents.length - 1)
})

test("listQuarterlyDrafts sincroniza periodos fiscales por defecto cuando aun no existen", async () => {
  const currentYear = new Date().getUTCFullYear()
  const store = {
    records: new Map(),
    fiscalPeriod: {
      async findUnique(args) {
        const lookup = args.where.ownerScopeId_periodKey
        return this.records?.get(`${lookup.ownerScopeId}:${lookup.periodKey}`) ?? null
      },
      async upsert(args) {
        const lookup = args.where.ownerScopeId_periodKey
        const key = `${lookup.ownerScopeId}:${lookup.periodKey}`
        const record = {
          id: `period_${lookup.periodKey.toLowerCase()}`,
          ownerScopeId: lookup.ownerScopeId,
          fiscalYear: args.create.fiscalYear,
          quarter: args.create.quarter,
          periodKey: args.create.periodKey,
          startsOn: args.create.startsOn,
          endsOn: args.create.endsOn,
          status: args.create.status,
          countryCode: args.create.countryCode,
          currencyCode: args.create.currencyCode,
          createdAt: new Date("2026-03-22T09:00:00.000Z"),
          updatedAt: new Date("2026-03-22T09:00:00.000Z"),
        }

        this.records?.set(key, record)
        return record
      },
      async findMany() {
        return Array.from(this.records?.values() ?? []).sort((left, right) => {
          if (left.fiscalYear !== right.fiscalYear) {
            return right.fiscalYear - left.fiscalYear
          }

          return right.quarter - left.quarter
        })
      },
    },
    transactionFiscal: {
      async findMany() {
        return []
      },
    },
  }

  store.fiscalPeriod.records = store.records

  const drafts = await listQuarterlyDrafts("fp_demo", store)

  assert.equal(drafts.length, 8)
  assert.deepEqual(
    drafts.map((draft) => draft.period.periodKey),
    [
      `${currentYear}-Q4`,
      `${currentYear}-Q3`,
      `${currentYear}-Q2`,
      `${currentYear}-Q1`,
      `${currentYear - 1}-Q4`,
      `${currentYear - 1}-Q3`,
      `${currentYear - 1}-Q2`,
      `${currentYear - 1}-Q1`,
    ]
  )
})
