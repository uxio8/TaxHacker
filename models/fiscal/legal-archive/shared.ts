import {
  FISCAL_PERIOD_STATUS_CLOSED,
  FISCAL_PERIOD_STATUS_IN_REVIEW,
  FISCAL_PERIOD_STATUS_OPEN,
  FISCAL_PERIOD_STATUS_PRESENTED,
  FISCAL_PERIOD_STATUS_READY,
  type FiscalPeriod,
  type FiscalPeriodStatus,
} from "../periods.ts"
import {
  REVIEW_STATUS_BLOCKED,
  REVIEW_STATUS_NEEDS_REVIEW,
  REVIEW_STATUS_PENDING,
  REVIEW_STATUS_READY,
  type ReviewStatus,
  type TransactionFiscalLine,
} from "../review-status.ts"
import type { TransactionFiscalDocument } from "../transaction-fiscal.ts"
import type {
  LegalArchiveAttachment,
  LegalArchiveAttachmentInput,
  LegalArchiveFileRecord,
  LegalArchiveFiscalPeriodRecord,
  LegalArchiveTransactionFiscalLineRecord,
  LegalArchiveTransactionFiscalRecord,
} from "./types.ts"

const REVIEW_STATUSES: ReviewStatus[] = [
  REVIEW_STATUS_READY,
  REVIEW_STATUS_NEEDS_REVIEW,
  REVIEW_STATUS_BLOCKED,
  REVIEW_STATUS_PENDING,
]

export function compareNullableString(left: string | null, right: string | null): number {
  if (left === right) {
    return 0
  }

  if (left === null) {
    return 1
  }

  if (right === null) {
    return -1
  }

  return left.localeCompare(right)
}

export function trimToNull(value?: string | null): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

export function matchesPeriodAssignment(periodKey: string, assignment?: { period_key: string } | null): boolean {
  return assignment?.period_key === periodKey
}

export function belongsToFiscalPeriod(period: FiscalPeriod, document: TransactionFiscalDocument): boolean {
  const { header } = document
  const matchesVat = matchesPeriodAssignment(period.periodKey, header.vat_period_assignment)
  const matchesWithholding = matchesPeriodAssignment(period.periodKey, header.withholding_period_assignment)
  return matchesVat || matchesWithholding
}

export function compareAttachments(left: LegalArchiveAttachment, right: LegalArchiveAttachment): number {
  return (
    left.filename.localeCompare(right.filename) ||
    left.id.localeCompare(right.id) ||
    compareNullableString(left.createdAt, right.createdAt)
  )
}

export function serializeDateOnly(value: Date | string | null): string | null {
  if (!value) {
    return null
  }

  if (typeof value === "string") {
    return value
  }

  return value.toISOString().slice(0, 10)
}

export function serializeDateTime(value: Date): string {
  return value.toISOString()
}

export function normalizeFiscalPeriodStatus(status: string): FiscalPeriodStatus {
  switch (status) {
    case FISCAL_PERIOD_STATUS_OPEN:
    case FISCAL_PERIOD_STATUS_IN_REVIEW:
    case FISCAL_PERIOD_STATUS_READY:
    case FISCAL_PERIOD_STATUS_PRESENTED:
    case FISCAL_PERIOD_STATUS_CLOSED:
      return status
    default:
      return FISCAL_PERIOD_STATUS_OPEN
  }
}

export function mapFiscalPeriodRecord(record: LegalArchiveFiscalPeriodRecord): FiscalPeriod {
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

export function normalizeReviewReasons(reviewReasons: string[]): string[] {
  return Array.isArray(reviewReasons)
    ? reviewReasons.filter((reason): reason is string => typeof reason === "string")
    : []
}

export function normalizeReviewStatus(reviewStatus: string): ReviewStatus {
  return REVIEW_STATUSES.includes(reviewStatus as ReviewStatus)
    ? (reviewStatus as ReviewStatus)
    : REVIEW_STATUS_PENDING
}

export function mapLineRecord(line: LegalArchiveTransactionFiscalLineRecord): TransactionFiscalLine {
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

export function mapTransactionFiscalRecord(record: LegalArchiveTransactionFiscalRecord): TransactionFiscalDocument {
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
      review_reasons: normalizeReviewReasons(record.reviewReasons),
      vat_period_assignment: record.vatPeriodAssignment,
      withholding_period_assignment: record.withholdingPeriodAssignment,
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

export function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
}

export function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

export function readNestedStringArray(value: unknown, key: string): string[] {
  const record = readRecord(value)
  return record ? readStringArray(record[key]) : []
}

export function readAttachmentByteSize(value: unknown): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const metadata = value as Record<string, unknown>
  return typeof metadata.size === "number" ? metadata.size : null
}

export function mapFileRecordToAttachment(file: LegalArchiveFileRecord): LegalArchiveAttachmentInput {
  return {
    id: file.id,
    filename: file.filename,
    mediaType: file.mimetype,
    byteSize: readAttachmentByteSize(file.metadata),
    createdAt: file.createdAt.toISOString(),
  }
}

export function hasDraftSnapshot(value: unknown): boolean {
  if (!value) {
    return false
  }

  if (Array.isArray(value)) {
    return value.length > 0
  }

  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length > 0
  }

  return true
}

export function sortAndNormalizeAttachments(
  attachments: LegalArchiveAttachmentInput[] | undefined
): LegalArchiveAttachment[] {
  return (attachments ?? [])
    .map((attachment) => ({
      id: attachment.id,
      filename: attachment.filename,
      mediaType: attachment.mediaType ?? null,
      byteSize: attachment.byteSize ?? null,
      createdAt: attachment.createdAt ?? null,
    }))
    .sort(compareAttachments)
}
