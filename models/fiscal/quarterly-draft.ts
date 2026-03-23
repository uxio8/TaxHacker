import {
  syncDefaultSpanishFiscalPeriodsV1,
  type FiscalPeriod,
  type FiscalPeriodStatus,
} from "./periods.ts"
import type { TransactionFiscalDocument } from "./transaction-fiscal.ts"
import { withFiscalStorageGuard } from "./storage.ts"
import type { PrismaClient } from "../../prisma/client/index.js"
import {
  REVIEW_STATUS_BLOCKED,
  REVIEW_STATUS_NEEDS_REVIEW,
  REVIEW_STATUS_PENDING,
  REVIEW_STATUS_READY,
  type FiscalPeriodAssignment,
  type ReviewStatus,
  type TransactionFiscalLine,
} from "./review-status.ts"

const REVIEW_STATUSES: ReviewStatus[] = [
  REVIEW_STATUS_READY,
  REVIEW_STATUS_NEEDS_REVIEW,
  REVIEW_STATUS_BLOCKED,
  REVIEW_STATUS_PENDING,
]

const FISCAL_PERIOD_STATUSES: FiscalPeriodStatus[] = [
  "open",
  "in_review",
  "ready",
  "presented",
  "closed",
] as const

const QUARTERLY_DRAFT_ROUTE_BASE = "/tax/quarters"

type QuarterlyDraftFiscalPeriodRecord = {
  id: string
  ownerScopeId: string
  fiscalYear: number
  quarter: number
  periodKey: string
  startsOn: Date
  endsOn: Date
  status: string
  countryCode: string
  currencyCode: string
  createdAt: Date
  updatedAt: Date
}

type QuarterlyDraftTransactionFiscalRecord = {
  id: string
  ownerScopeId: string
  sourceTransactionId: string
  documentKind: string
  direction: string
  invoiceNumber: string | null
  invoiceSeries: string | null
  issueDate: Date
  operationDate: Date | null
  paymentDate: Date | null
  currencyCode: string
  counterpartyId: string | null
  counterpartyRole: string
  counterpartyName: string | null
  counterpartyTaxId: string | null
  counterpartyCountryCode: string
  companyTaxId: string | null
  reviewStatus: string
  reviewReasons: unknown
  vatPeriodAssignment: unknown
  withholdingPeriodAssignment: unknown
  observedAmountCents: number
  totalNetCents: number
  totalVatCents: number
  totalWithholdingCents: number
  totalGrossCents: number
  totalPayableCents: number
  sourceConfidence: string
  notes: string | null
  lines: QuarterlyDraftTransactionFiscalLineRecord[]
}

type QuarterlyDraftTransactionFiscalLineRecord = {
  id: string
  transactionFiscalId: string
  lineNumber: number
  concept: string
  baseAmountCents: number
  vatTreatment: string
  vatRateBps: number
  vatAmountCents: number
  withholdingApplicable: boolean
  withholdingRegime: string
  withholdingBaseCents: number
  withholdingRateBps: number
  withholdingAmountCents: number
  deductibilityPercentBps: number
  deductibilityReason: string
  expenseFamily: string
  isReadyForVatBooks: boolean
  isReadyForWithholdingBooks: boolean
}

type QuarterlyDraftStore = {
  fiscalPeriod: {
    findMany(args: {
      where: { ownerScopeId: string }
      orderBy: Array<Record<string, "asc" | "desc">>
    }): Promise<QuarterlyDraftFiscalPeriodRecord[]>
    findUnique(args: {
      where: {
        ownerScopeId_periodKey: {
          ownerScopeId: string
          periodKey: string
        }
      }
    }): Promise<QuarterlyDraftFiscalPeriodRecord | null>
    upsert(args: {
      where: {
        ownerScopeId_periodKey: {
          ownerScopeId: string
          periodKey: string
        }
      }
      update: {
        fiscalYear: number
        quarter: number
        periodKey: string
        startsOn: Date
        endsOn: Date
        status: string
        countryCode: string
        currencyCode: string
      }
      create: {
        ownerScopeId: string
        fiscalYear: number
        quarter: number
        periodKey: string
        startsOn: Date
        endsOn: Date
        status: string
        countryCode: string
        currencyCode: string
      }
    }): Promise<QuarterlyDraftFiscalPeriodRecord>
  }
  transactionFiscal: {
    findMany(args: {
      where: { ownerScopeId: string }
      include: {
        lines: {
          orderBy: {
            lineNumber: "asc"
          }
        }
      }
      orderBy: Array<Record<string, "asc" | "desc">>
    }): Promise<QuarterlyDraftTransactionFiscalRecord[]>
  }
}

type QuarterlyDraftDbClient = Pick<PrismaClient, "fiscalPeriod" | "transactionFiscal">

export type QuarterlyDraftOperationalStatusCode =
  | "open"
  | "review_pending"
  | "review_blocked"
  | "ready"
  | "presented"
  | "closed"

export type QuarterlyDraftStatusTotals = {
  reviewStatus: ReviewStatus
  documentCount: number
  observedAmountCents: number
  totalNetCents: number
  totalVatCents: number
  totalWithholdingCents: number
  totalGrossCents: number
  totalPayableCents: number
}

export type QuarterlyDraftDocument = {
  fiscalDocumentId: string
  sourceTransactionId: string
  issueDate: string | null
  invoiceNumber: string | null
  counterpartyName: string | null
  counterpartyTaxId: string | null
  reviewStatus: ReviewStatus
  reviewReasons: string[]
  observedAmountCents: number
  totalNetCents: number
  totalVatCents: number
  totalWithholdingCents: number
  totalGrossCents: number
  totalPayableCents: number
  includesVat: boolean
  includesWithholding: boolean
  transactionHref: string
  factHref: string
}

export type QuarterlyDraft = {
  period: FiscalPeriod
  periodHref: string
  operationalStatus: {
    code: QuarterlyDraftOperationalStatusCode
    periodStatus: FiscalPeriodStatus
    documentCount: number
    readyDocumentCount: number
    reviewDocumentCount: number
    blockingDocumentCount: number
  }
  reviewStatusCounts: Record<ReviewStatus, number>
  reviewStatusTotals: Record<ReviewStatus, QuarterlyDraftStatusTotals>
  totals: {
    documentCount: number
    observedAmountCents: number
    totalNetCents: number
    totalVatCents: number
    totalWithholdingCents: number
    totalGrossCents: number
    totalPayableCents: number
    model303DocumentCount: number
    model115DocumentCount: number
  }
  model303DocumentIds: string[]
  model115DocumentIds: string[]
  documents: QuarterlyDraftDocument[]
}

function trimToNull(value?: string | null): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function createEmptyStatusTotals(reviewStatus: ReviewStatus): QuarterlyDraftStatusTotals {
  return {
    reviewStatus,
    documentCount: 0,
    observedAmountCents: 0,
    totalNetCents: 0,
    totalVatCents: 0,
    totalWithholdingCents: 0,
    totalGrossCents: 0,
    totalPayableCents: 0,
  }
}

function createEmptyStatusTotalsMap(): Record<ReviewStatus, QuarterlyDraftStatusTotals> {
  return {
    [REVIEW_STATUS_READY]: createEmptyStatusTotals(REVIEW_STATUS_READY),
    [REVIEW_STATUS_NEEDS_REVIEW]: createEmptyStatusTotals(REVIEW_STATUS_NEEDS_REVIEW),
    [REVIEW_STATUS_BLOCKED]: createEmptyStatusTotals(REVIEW_STATUS_BLOCKED),
    [REVIEW_STATUS_PENDING]: createEmptyStatusTotals(REVIEW_STATUS_PENDING),
  }
}

function matchesPeriodAssignment(periodKey: string, assignment?: { period_key: string } | null): boolean {
  return assignment?.period_key === periodKey
}

function belongsToFiscalPeriod(period: FiscalPeriod, document: TransactionFiscalDocument): boolean {
  const { header } = document
  const matchesVat = matchesPeriodAssignment(period.periodKey, header.vat_period_assignment)
  const matchesWithholding = matchesPeriodAssignment(period.periodKey, header.withholding_period_assignment)
  return matchesVat || matchesWithholding
}

function determineOperationalStatus(
  periodStatus: FiscalPeriodStatus,
  reviewStatusCounts: Record<ReviewStatus, number>
): QuarterlyDraftOperationalStatusCode {
  if (periodStatus === "closed") {
    return "closed"
  }

  if (periodStatus === "presented") {
    return "presented"
  }

  if (reviewStatusCounts.blocked > 0) {
    return "review_blocked"
  }

  if (reviewStatusCounts.needs_review > 0 || reviewStatusCounts.pending > 0 || periodStatus === "in_review") {
    return "review_pending"
  }

  if (reviewStatusCounts.ready > 0 || periodStatus === "ready") {
    return "ready"
  }

  return "open"
}

function buildStatusCounts(
  reviewStatusTotals: Record<ReviewStatus, QuarterlyDraftStatusTotals>
): Record<ReviewStatus, number> {
  return {
    ready: reviewStatusTotals.ready.documentCount,
    needs_review: reviewStatusTotals.needs_review.documentCount,
    blocked: reviewStatusTotals.blocked.documentCount,
    pending: reviewStatusTotals.pending.documentCount,
  }
}

function serializeDateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null
}

function serializeDateTime(value: Date): string {
  return value.toISOString()
}

function normalizeOwnerScopeId(ownerScopeId: string): string {
  const normalized = trimToNull(ownerScopeId)

  if (!normalized) {
    throw new Error("ownerScopeId es obligatorio para construir el borrador trimestral")
  }

  return normalized
}

function normalizeFiscalPeriodStatus(status: string): FiscalPeriodStatus {
  if (FISCAL_PERIOD_STATUSES.includes(status as FiscalPeriodStatus)) {
    return status as FiscalPeriodStatus
  }

  throw new Error(`FiscalPeriod.status desconocido: ${status}`)
}

function normalizeReviewStatus(status: string): ReviewStatus {
  if (REVIEW_STATUSES.includes(status as ReviewStatus)) {
    return status as ReviewStatus
  }

  return REVIEW_STATUS_PENDING
}

function mapReviewReasons(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((entry): entry is string => typeof entry === "string")
}

function mapFiscalPeriodAssignment(value: unknown): FiscalPeriodAssignment | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const assignment = value as Record<string, unknown>

  if (
    typeof assignment.fiscal_year !== "number" ||
    typeof assignment.quarter !== "number" ||
    typeof assignment.period_key !== "string" ||
    typeof assignment.basis !== "string" ||
    typeof assignment.assigned_at !== "string"
  ) {
    return null
  }

  return {
    fiscal_year: assignment.fiscal_year,
    quarter: assignment.quarter,
    period_key: assignment.period_key,
    basis: assignment.basis,
    assigned_at: assignment.assigned_at,
  }
}

function mapFiscalPeriodRecord(record: QuarterlyDraftFiscalPeriodRecord): FiscalPeriod {
  return {
    id: record.id,
    ownerScopeId: record.ownerScopeId,
    fiscalYear: record.fiscalYear,
    quarter: record.quarter,
    periodKey: record.periodKey,
    startsOn: serializeDateOnly(record.startsOn) ?? "",
    endsOn: serializeDateOnly(record.endsOn) ?? "",
    status: normalizeFiscalPeriodStatus(record.status),
    countryCode: record.countryCode,
    currencyCode: record.currencyCode,
    createdAt: serializeDateTime(record.createdAt),
    updatedAt: serializeDateTime(record.updatedAt),
  }
}

function mapLineRecord(line: QuarterlyDraftTransactionFiscalLineRecord): TransactionFiscalLine {
  return {
    line_id: line.id,
    fiscal_document_id: line.transactionFiscalId,
    line_number: line.lineNumber,
    concept: line.concept,
    base_amount_cents: line.baseAmountCents,
    vat_treatment: line.vatTreatment,
    vat_rate_bps: line.vatRateBps,
    vat_amount_cents: line.vatAmountCents,
    withholding_applicable: line.withholdingApplicable,
    withholding_regime: line.withholdingRegime,
    withholding_base_cents: line.withholdingBaseCents,
    withholding_rate_bps: line.withholdingRateBps,
    withholding_amount_cents: line.withholdingAmountCents,
    deductibility_percent_bps: line.deductibilityPercentBps,
    deductibility_reason: line.deductibilityReason,
    expense_family: line.expenseFamily,
    is_ready_for_vat_books: line.isReadyForVatBooks,
    is_ready_for_withholding_books: line.isReadyForWithholdingBooks,
  }
}

function mapTransactionFiscalRecord(
  record: QuarterlyDraftTransactionFiscalRecord
): TransactionFiscalDocument {
  return {
    header: {
      fiscal_document_id: record.id,
      source_transaction_id: record.sourceTransactionId,
      document_kind: record.documentKind,
      direction: record.direction,
      invoice_number: record.invoiceNumber,
      invoice_series: record.invoiceSeries,
      issue_date: serializeDateOnly(record.issueDate),
      operation_date: serializeDateOnly(record.operationDate),
      payment_date: serializeDateOnly(record.paymentDate),
      currency_code: record.currencyCode,
      counterparty_id: record.counterpartyId,
      counterparty_role: record.counterpartyRole,
      counterparty_name: record.counterpartyName,
      counterparty_tax_id: record.counterpartyTaxId,
      counterparty_country_code: record.counterpartyCountryCode,
      company_tax_id: record.companyTaxId,
      review_status: normalizeReviewStatus(record.reviewStatus),
      review_reasons: mapReviewReasons(record.reviewReasons),
      vat_period_assignment: mapFiscalPeriodAssignment(record.vatPeriodAssignment),
      withholding_period_assignment: mapFiscalPeriodAssignment(record.withholdingPeriodAssignment),
      observed_amount_cents: record.observedAmountCents,
      total_net_cents: record.totalNetCents,
      total_vat_cents: record.totalVatCents,
      total_withholding_cents: record.totalWithholdingCents,
      total_gross_cents: record.totalGrossCents,
      total_payable_cents: record.totalPayableCents,
      source_confidence: record.sourceConfidence,
      notes: record.notes,
    },
    lines: record.lines.map(mapLineRecord),
  }
}

async function resolveQuarterlyDraftStore(store?: QuarterlyDraftStore): Promise<QuarterlyDraftStore> {
  if (store) {
    return store
  }

  const { prisma } = await import("../../lib/db.ts")
  return prisma as QuarterlyDraftDbClient
}

async function listQuarterlyDraftDocuments(
  ownerScopeId: string,
  store?: QuarterlyDraftStore
): Promise<TransactionFiscalDocument[]> {
  const db = await resolveQuarterlyDraftStore(store)
  const records = await db.transactionFiscal.findMany({
    where: {
      ownerScopeId: normalizeOwnerScopeId(ownerScopeId),
    },
    include: {
      lines: {
        orderBy: {
          lineNumber: "asc",
        },
      },
    },
    orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }, { id: "asc" }],
  })

  return records.map(mapTransactionFiscalRecord)
}

export function buildQuarterlyDraftPeriodHref(periodKey: string): string {
  return `${QUARTERLY_DRAFT_ROUTE_BASE}/${periodKey}`
}

export function buildQuarterlyDraftFactHref(periodKey: string, fiscalDocumentId: string): string {
  return `${buildQuarterlyDraftPeriodHref(periodKey)}#fact-${fiscalDocumentId}`
}

export function buildQuarterlyDraftTransactionHref(sourceTransactionId: string): string {
  return `/transactions/${sourceTransactionId}`
}

export function buildQuarterlyDraft(
  period: FiscalPeriod,
  documents: TransactionFiscalDocument[]
): QuarterlyDraft {
  const reviewStatusTotals = createEmptyStatusTotalsMap()
  const periodDocuments = documents.filter((document) => belongsToFiscalPeriod(period, document))
  const draftDocuments = periodDocuments.map((document) => {
    const reviewStatus = document.header.review_status as ReviewStatus
    const statusTotals = reviewStatusTotals[reviewStatus] ?? reviewStatusTotals.pending

    statusTotals.documentCount += 1
    statusTotals.observedAmountCents += document.header.observed_amount_cents
    statusTotals.totalNetCents += document.header.total_net_cents
    statusTotals.totalVatCents += document.header.total_vat_cents
    statusTotals.totalWithholdingCents += document.header.total_withholding_cents
    statusTotals.totalGrossCents += document.header.total_gross_cents
    statusTotals.totalPayableCents += document.header.total_payable_cents

    const includesVat = matchesPeriodAssignment(period.periodKey, document.header.vat_period_assignment)
    const includesWithholding = matchesPeriodAssignment(
      period.periodKey,
      document.header.withholding_period_assignment
    )

    return {
      fiscalDocumentId: document.header.fiscal_document_id,
      sourceTransactionId: document.header.source_transaction_id,
      issueDate: document.header.issue_date,
      invoiceNumber: document.header.invoice_number,
      counterpartyName: document.header.counterparty_name,
      counterpartyTaxId: document.header.counterparty_tax_id,
      reviewStatus,
      reviewReasons: document.header.review_reasons,
      observedAmountCents: document.header.observed_amount_cents,
      totalNetCents: document.header.total_net_cents,
      totalVatCents: document.header.total_vat_cents,
      totalWithholdingCents: document.header.total_withholding_cents,
      totalGrossCents: document.header.total_gross_cents,
      totalPayableCents: document.header.total_payable_cents,
      includesVat,
      includesWithholding,
      transactionHref: buildQuarterlyDraftTransactionHref(document.header.source_transaction_id),
      factHref: buildQuarterlyDraftFactHref(period.periodKey, document.header.fiscal_document_id),
    }
  })
  const reviewStatusCounts = buildStatusCounts(reviewStatusTotals)
  const model303DocumentIds = periodDocuments
    .filter(
      (document) =>
        matchesPeriodAssignment(period.periodKey, document.header.vat_period_assignment) &&
        document.lines.some((line) => line.is_ready_for_vat_books)
    )
    .map((document) => document.header.fiscal_document_id)
  const model115DocumentIds = periodDocuments
    .filter(
      (document) =>
        matchesPeriodAssignment(period.periodKey, document.header.withholding_period_assignment) &&
        document.lines.some((line) => line.is_ready_for_withholding_books)
    )
    .map((document) => document.header.fiscal_document_id)
  const totals = draftDocuments.reduce(
    (accumulator, document) => {
      accumulator.documentCount += 1
      accumulator.observedAmountCents += document.observedAmountCents
      accumulator.totalNetCents += document.totalNetCents
      accumulator.totalVatCents += document.totalVatCents
      accumulator.totalWithholdingCents += document.totalWithholdingCents
      accumulator.totalGrossCents += document.totalGrossCents
      accumulator.totalPayableCents += document.totalPayableCents
      return accumulator
    },
    {
      documentCount: 0,
      observedAmountCents: 0,
      totalNetCents: 0,
      totalVatCents: 0,
      totalWithholdingCents: 0,
      totalGrossCents: 0,
      totalPayableCents: 0,
      model303DocumentCount: model303DocumentIds.length,
      model115DocumentCount: model115DocumentIds.length,
    }
  )

  for (const reviewStatus of REVIEW_STATUSES) {
    reviewStatusTotals[reviewStatus] = {
      ...reviewStatusTotals[reviewStatus],
    }
  }

  return {
    period,
    periodHref: buildQuarterlyDraftPeriodHref(period.periodKey),
    operationalStatus: {
      code: determineOperationalStatus(period.status, reviewStatusCounts),
      periodStatus: period.status,
      documentCount: totals.documentCount,
      readyDocumentCount: reviewStatusCounts.ready,
      reviewDocumentCount: reviewStatusCounts.needs_review + reviewStatusCounts.pending,
      blockingDocumentCount: reviewStatusCounts.blocked,
    },
    reviewStatusCounts,
    reviewStatusTotals,
    totals,
    model303DocumentIds,
    model115DocumentIds,
    documents: draftDocuments,
  }
}

export async function listQuarterlyDrafts(
  ownerScopeId: string,
  store?: QuarterlyDraftStore
): Promise<QuarterlyDraft[]> {
  return withFiscalStorageGuard(async () => {
    const normalizedOwnerScopeId = normalizeOwnerScopeId(ownerScopeId)
    const db = await resolveQuarterlyDraftStore(store)
    await syncDefaultSpanishFiscalPeriodsV1(normalizedOwnerScopeId, undefined, db)
    const [periodRecords, documents] = await Promise.all([
      db.fiscalPeriod.findMany({
        where: {
          ownerScopeId: normalizedOwnerScopeId,
        },
        orderBy: [{ fiscalYear: "desc" }, { quarter: "desc" }],
      }),
      listQuarterlyDraftDocuments(normalizedOwnerScopeId, db),
    ])

    return periodRecords.map((record) => buildQuarterlyDraft(mapFiscalPeriodRecord(record), documents))
  })
}

export async function getQuarterlyDraftByPeriodKey(
  ownerScopeId: string,
  periodKey: string,
  store?: QuarterlyDraftStore
): Promise<QuarterlyDraft | null> {
  return withFiscalStorageGuard(async () => {
    const normalizedOwnerScopeId = normalizeOwnerScopeId(ownerScopeId)
    const normalizedPeriodKey = trimToNull(periodKey)

    if (!normalizedPeriodKey) {
      throw new Error("periodKey es obligatorio para cargar el borrador trimestral")
    }

    const db = await resolveQuarterlyDraftStore(store)
    await syncDefaultSpanishFiscalPeriodsV1(normalizedOwnerScopeId, undefined, db)
    const [periodRecord, documents] = await Promise.all([
      db.fiscalPeriod.findUnique({
        where: {
          ownerScopeId_periodKey: {
            ownerScopeId: normalizedOwnerScopeId,
            periodKey: normalizedPeriodKey,
          },
        },
      }),
      listQuarterlyDraftDocuments(normalizedOwnerScopeId, db),
    ])

    if (!periodRecord) {
      return null
    }

    return buildQuarterlyDraft(mapFiscalPeriodRecord(periodRecord), documents)
  })
}
