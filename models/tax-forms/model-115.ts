import { buildFiscalPeriodKey } from "../fiscal/periods.ts"
import type { TransactionFiscalDocument } from "../fiscal/transaction-fiscal.ts"

const MODEL_115_CURRENCY_CODE = "EUR" as const
const MODEL_115_DOCUMENT_KIND = "received_invoice" as const
const MODEL_115_DIRECTION = "incoming" as const
const MODEL_115_WITHHOLDING_REGIME = "rent" as const
export const MODEL_115_DRILLDOWN_BASE_PATH = "/transactions" as const

export type Model115DraftInput = {
  documents: TransactionFiscalDocument[]
  fiscalYear: number
  quarter: number
}

export type Model115SourceLine = {
  fiscal_document_id: string
  source_transaction_id: string
  source_transaction_href: string
  line_id: string
  line_number: number
  issue_date: string
  invoice_number: string | null
  counterparty_id: string | null
  counterparty_name: string | null
  counterparty_tax_id: string | null
  concept: string
  withholding_period_key: string
  withholding_rate_bps: number
  rent_base_cents: number
  withholding_cents: number
}

export type Model115PerceptorAggregate = {
  counterparty_id: string | null
  counterparty_name: string | null
  counterparty_tax_id: string | null
  document_ids: string[]
  source_transaction_ids: string[]
  rent_base_cents: number
  withholding_cents: number
}

export type Model115AffectedLandlord = Model115PerceptorAggregate

export type Model115ReadinessSummary = {
  candidate_document_count: number
  included_document_count: number
  ready_document_count: number
  blocked_document_count: number
  needs_review_document_count: number
  pending_document_count: number
  source_line_count: number
}

export type Model115Draft = {
  fiscal_year: number
  quarter: number
  period_key: string
  currency_code: typeof MODEL_115_CURRENCY_CODE
  documents_included: string[]
  landlord_counterparty_ids: string[]
  perceptor_count: number
  rent_base_cents: number
  withholding_cents: number
  perceptors: Model115PerceptorAggregate[]
  affected_landlords: Model115AffectedLandlord[]
  source_lines: Model115SourceLine[]
  readiness: Model115ReadinessSummary
}

type MutableLandlordSummary = {
  counterparty_id: string | null
  counterparty_name: string | null
  counterparty_tax_id: string | null
  document_ids: Set<string>
  source_transaction_ids: Set<string>
  rent_base_cents: number
  withholding_cents: number
}

function assertSupportedCurrency(document: TransactionFiscalDocument) {
  if (document.header.currency_code !== MODEL_115_CURRENCY_CODE) {
    throw new Error(`Model 115 V1 solo admite currency_code=${MODEL_115_CURRENCY_CODE}`)
  }
}

function assertIssueDate(document: TransactionFiscalDocument): string {
  if (!document.header.issue_date) {
    throw new Error(
      `Model 115 requiere issue_date para el documento ${document.header.fiscal_document_id}`
    )
  }

  return document.header.issue_date
}

function isMatchingDocumentKind(document: TransactionFiscalDocument) {
  return (
    document.header.document_kind === MODEL_115_DOCUMENT_KIND &&
    document.header.direction === MODEL_115_DIRECTION
  )
}

function isMatchingWithholdingPeriod(document: TransactionFiscalDocument, periodKey: string) {
  return document.header.withholding_period_assignment?.period_key === periodKey
}

function isRentWithholdingLine(line: TransactionFiscalDocument["lines"][number]) {
  return line.withholding_applicable && line.withholding_regime === MODEL_115_WITHHOLDING_REGIME
}

function hasRentWithholdingCandidate(document: TransactionFiscalDocument) {
  return document.lines.some(isRentWithholdingLine)
}

function buildLandlordAggregationKey(document: TransactionFiscalDocument) {
  return (
    document.header.counterparty_id ??
    document.header.counterparty_tax_id ??
    document.header.counterparty_name ??
    `unlinked:${document.header.fiscal_document_id}`
  )
}

function compareSourceLines(left: Model115SourceLine, right: Model115SourceLine) {
  return (
    left.issue_date.localeCompare(right.issue_date) ||
    (left.invoice_number ?? "").localeCompare(right.invoice_number ?? "") ||
    left.line_number - right.line_number ||
    left.fiscal_document_id.localeCompare(right.fiscal_document_id) ||
    left.line_id.localeCompare(right.line_id)
  )
}

function compareLandlords(left: Model115AffectedLandlord, right: Model115AffectedLandlord) {
  return (
    (left.counterparty_name ?? "").localeCompare(right.counterparty_name ?? "") ||
    (left.counterparty_tax_id ?? "").localeCompare(right.counterparty_tax_id ?? "") ||
    (left.counterparty_id ?? "").localeCompare(right.counterparty_id ?? "")
  )
}

export function buildModel115Draft(input: Model115DraftInput): Model115Draft {
  const periodKey = buildFiscalPeriodKey(input.fiscalYear, input.quarter)
  const sourceLines: Model115SourceLine[] = []
  const includedDocumentIds = new Set<string>()
  const landlordCounterpartyIds = new Set<string>()
  const affectedLandlords = new Map<string, MutableLandlordSummary>()
  const candidateDocumentIds = new Set<string>()
  const blockedDocumentIds = new Set<string>()
  const needsReviewDocumentIds = new Set<string>()
  const pendingDocumentIds = new Set<string>()
  const readyDocumentIds = new Set<string>()

  for (const document of input.documents) {
    if (!isMatchingDocumentKind(document) || !isMatchingWithholdingPeriod(document, periodKey)) {
      continue
    }

    if (!hasRentWithholdingCandidate(document)) {
      continue
    }

    candidateDocumentIds.add(document.header.fiscal_document_id)

    if (document.header.review_status === "blocked") {
      blockedDocumentIds.add(document.header.fiscal_document_id)
    } else if (document.header.review_status === "needs_review") {
      needsReviewDocumentIds.add(document.header.fiscal_document_id)
    } else if (document.header.review_status === "pending") {
      pendingDocumentIds.add(document.header.fiscal_document_id)
    }

    let issueDate: string | null = null

    for (const line of document.lines) {
      if (!isRentWithholdingLine(line) || !line.is_ready_for_withholding_books) {
        continue
      }

      if (!issueDate) {
        assertSupportedCurrency(document)
        issueDate = assertIssueDate(document)
      }

      const traceLine: Model115SourceLine = {
        fiscal_document_id: document.header.fiscal_document_id,
        source_transaction_id: document.header.source_transaction_id,
        source_transaction_href: `${MODEL_115_DRILLDOWN_BASE_PATH}/${document.header.source_transaction_id}`,
        line_id: line.line_id,
        line_number: line.line_number,
        issue_date: issueDate,
        invoice_number: document.header.invoice_number,
        counterparty_id: document.header.counterparty_id,
        counterparty_name: document.header.counterparty_name,
        counterparty_tax_id: document.header.counterparty_tax_id,
        concept: line.concept,
        withholding_period_key: periodKey,
        withholding_rate_bps: line.withholding_rate_bps,
        rent_base_cents: line.withholding_base_cents,
        withholding_cents: line.withholding_amount_cents,
      }

      sourceLines.push(traceLine)
      includedDocumentIds.add(document.header.fiscal_document_id)
      readyDocumentIds.add(document.header.fiscal_document_id)

      if (document.header.counterparty_id) {
        landlordCounterpartyIds.add(document.header.counterparty_id)
      }

      const landlordKey = buildLandlordAggregationKey(document)
      const currentLandlord =
        affectedLandlords.get(landlordKey) ??
        ({
          counterparty_id: document.header.counterparty_id,
          counterparty_name: document.header.counterparty_name,
          counterparty_tax_id: document.header.counterparty_tax_id,
          document_ids: new Set<string>(),
          source_transaction_ids: new Set<string>(),
          rent_base_cents: 0,
          withholding_cents: 0,
        } satisfies MutableLandlordSummary)

      currentLandlord.document_ids.add(document.header.fiscal_document_id)
      currentLandlord.source_transaction_ids.add(document.header.source_transaction_id)
      currentLandlord.rent_base_cents += line.withholding_base_cents
      currentLandlord.withholding_cents += line.withholding_amount_cents
      affectedLandlords.set(landlordKey, currentLandlord)
    }
  }

  sourceLines.sort(compareSourceLines)

  const landlords = [...affectedLandlords.values()]
    .map<Model115PerceptorAggregate>((landlord) => ({
      counterparty_id: landlord.counterparty_id,
      counterparty_name: landlord.counterparty_name,
      counterparty_tax_id: landlord.counterparty_tax_id,
      document_ids: [...landlord.document_ids].sort(),
      source_transaction_ids: [...landlord.source_transaction_ids].sort(),
      rent_base_cents: landlord.rent_base_cents,
      withholding_cents: landlord.withholding_cents,
    }))
    .sort(compareLandlords)

  return {
    fiscal_year: input.fiscalYear,
    quarter: input.quarter,
    period_key: periodKey,
    currency_code: MODEL_115_CURRENCY_CODE,
    documents_included: [...includedDocumentIds].sort(),
    landlord_counterparty_ids: [...landlordCounterpartyIds].sort(),
    perceptor_count: landlords.length,
    rent_base_cents: sourceLines.reduce((total, line) => total + line.rent_base_cents, 0),
    withholding_cents: sourceLines.reduce((total, line) => total + line.withholding_cents, 0),
    perceptors: landlords,
    affected_landlords: landlords,
    source_lines: sourceLines,
    readiness: {
      candidate_document_count: candidateDocumentIds.size,
      included_document_count: includedDocumentIds.size,
      ready_document_count: readyDocumentIds.size,
      blocked_document_count: blockedDocumentIds.size,
      needs_review_document_count: needsReviewDocumentIds.size,
      pending_document_count: pendingDocumentIds.size,
      source_line_count: sourceLines.length,
    },
  }
}
