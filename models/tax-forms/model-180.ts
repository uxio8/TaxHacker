import type { TransactionFiscalDocument } from "../fiscal/transaction-fiscal.ts"
import {
  buildModel115Draft,
  type Model115Draft,
  type Model115PerceptorAggregate,
  type Model115ReadinessSummary,
  type Model115SourceLine,
} from "./model-115.ts"

export const MODEL_180_CURRENCY_CODE = "EUR" as const
export const MODEL_180_QUARTERS = [1, 2, 3, 4] as const

export type Model180Quarter = (typeof MODEL_180_QUARTERS)[number]

export type Model180QuarterSummary = {
  quarter: Model180Quarter
  period_key: string
  documents_included: string[]
  perceptor_count: number
  rent_base_cents: number
  withholding_cents: number
}

export type Model180PerceptorQuarterBreakdown = {
  quarter: Model180Quarter
  period_key: string
  document_count: number
  rent_base_cents: number
  withholding_cents: number
}

export type Model180PerceptorAggregate = Omit<Model115PerceptorAggregate, "document_ids" | "source_transaction_ids"> & {
  document_ids: string[]
  source_transaction_ids: string[]
  quarter_breakdown: Model180PerceptorQuarterBreakdown[]
}

export type Model180SourceLine = Model115SourceLine & {
  quarter: Model180Quarter
  annual_period_key: string
}

export type Model180Draft = {
  fiscal_year: number
  period_key: string
  currency_code: typeof MODEL_180_CURRENCY_CODE
  documents_included: string[]
  perceptor_count: number
  rent_base_cents: number
  withholding_cents: number
  perceptors: Model180PerceptorAggregate[]
  quarter_summaries: Model180QuarterSummary[]
  source_lines: Model180SourceLine[]
  readiness: Model115ReadinessSummary
}

export type Model180DraftInput = {
  documents: TransactionFiscalDocument[]
  fiscalYear: number
}

type MutablePerceptorAggregate = {
  counterparty_id: string | null
  counterparty_name: string | null
  counterparty_tax_id: string | null
  document_ids: Set<string>
  source_transaction_ids: Set<string>
  rent_base_cents: number
  withholding_cents: number
  quarter_breakdown: Model180PerceptorQuarterBreakdown[]
}

function buildAnnualPeriodKey(fiscalYear: number) {
  return `${fiscalYear}-Y`
}

function buildQuarterlyDrafts(input: Model180DraftInput): Model115Draft[] {
  return MODEL_180_QUARTERS.map((quarter) =>
    buildModel115Draft({
      documents: input.documents,
      fiscalYear: input.fiscalYear,
      quarter,
    })
  )
}

function buildPerceptorKey(perceptor: Model115PerceptorAggregate) {
  return (
    perceptor.counterparty_id
    ?? perceptor.counterparty_tax_id
    ?? perceptor.counterparty_name
    ?? `perceptor:${perceptor.document_ids.join("-")}`
  )
}

function comparePerceptors(left: Model180PerceptorAggregate, right: Model180PerceptorAggregate) {
  return (
    (left.counterparty_name ?? "").localeCompare(right.counterparty_name ?? "")
    || (left.counterparty_tax_id ?? "").localeCompare(right.counterparty_tax_id ?? "")
    || (left.counterparty_id ?? "").localeCompare(right.counterparty_id ?? "")
  )
}

function compareSourceLines(left: Model180SourceLine, right: Model180SourceLine) {
  return (
    left.quarter - right.quarter
    || left.issue_date.localeCompare(right.issue_date)
    || (left.invoice_number ?? "").localeCompare(right.invoice_number ?? "")
    || left.line_number - right.line_number
    || left.fiscal_document_id.localeCompare(right.fiscal_document_id)
    || left.line_id.localeCompare(right.line_id)
  )
}

export function buildModel180Draft(input: Model180DraftInput): Model180Draft {
  const periodKey = buildAnnualPeriodKey(input.fiscalYear)
  const quarterlyDrafts = buildQuarterlyDrafts(input)
  const includedDocumentIds = new Set<string>()
  const perceptorAggregates = new Map<string, MutablePerceptorAggregate>()
  const sourceLines: Model180SourceLine[] = []
  const readiness: Model115ReadinessSummary = {
    candidate_document_count: 0,
    included_document_count: 0,
    ready_document_count: 0,
    blocked_document_count: 0,
    needs_review_document_count: 0,
    pending_document_count: 0,
    source_line_count: 0,
  }

  const quarterSummaries = quarterlyDrafts.map<Model180QuarterSummary>((quarterlyDraft) => {
    const quarter = quarterlyDraft.quarter as Model180Quarter

    for (const documentId of quarterlyDraft.documents_included) {
      includedDocumentIds.add(documentId)
    }

    for (const perceptor of quarterlyDraft.perceptors) {
      const perceptorKey = buildPerceptorKey(perceptor)
      const currentAggregate =
        perceptorAggregates.get(perceptorKey)
        ?? {
          counterparty_id: perceptor.counterparty_id,
          counterparty_name: perceptor.counterparty_name,
          counterparty_tax_id: perceptor.counterparty_tax_id,
          document_ids: new Set<string>(),
          source_transaction_ids: new Set<string>(),
          rent_base_cents: 0,
          withholding_cents: 0,
          quarter_breakdown: [],
        }

      for (const documentId of perceptor.document_ids) {
        currentAggregate.document_ids.add(documentId)
      }

      for (const sourceTransactionId of perceptor.source_transaction_ids) {
        currentAggregate.source_transaction_ids.add(sourceTransactionId)
      }

      currentAggregate.rent_base_cents += perceptor.rent_base_cents
      currentAggregate.withholding_cents += perceptor.withholding_cents
      currentAggregate.quarter_breakdown.push({
        quarter,
        period_key: quarterlyDraft.period_key,
        document_count: perceptor.document_ids.length,
        rent_base_cents: perceptor.rent_base_cents,
        withholding_cents: perceptor.withholding_cents,
      })
      perceptorAggregates.set(perceptorKey, currentAggregate)
    }

    for (const line of quarterlyDraft.source_lines) {
      sourceLines.push({
        ...line,
        quarter,
        annual_period_key: periodKey,
      })
    }

    readiness.candidate_document_count += quarterlyDraft.readiness.candidate_document_count
    readiness.included_document_count += quarterlyDraft.readiness.included_document_count
    readiness.ready_document_count += quarterlyDraft.readiness.ready_document_count
    readiness.blocked_document_count += quarterlyDraft.readiness.blocked_document_count
    readiness.needs_review_document_count += quarterlyDraft.readiness.needs_review_document_count
    readiness.pending_document_count += quarterlyDraft.readiness.pending_document_count
    readiness.source_line_count += quarterlyDraft.readiness.source_line_count

    return {
      quarter,
      period_key: quarterlyDraft.period_key,
      documents_included: quarterlyDraft.documents_included,
      perceptor_count: quarterlyDraft.perceptor_count,
      rent_base_cents: quarterlyDraft.rent_base_cents,
      withholding_cents: quarterlyDraft.withholding_cents,
    }
  })

  const perceptors = [...perceptorAggregates.values()]
    .map<Model180PerceptorAggregate>((perceptor) => ({
      counterparty_id: perceptor.counterparty_id,
      counterparty_name: perceptor.counterparty_name,
      counterparty_tax_id: perceptor.counterparty_tax_id,
      document_ids: [...perceptor.document_ids].sort(),
      source_transaction_ids: [...perceptor.source_transaction_ids].sort(),
      rent_base_cents: perceptor.rent_base_cents,
      withholding_cents: perceptor.withholding_cents,
      quarter_breakdown: perceptor.quarter_breakdown.sort((left, right) => left.quarter - right.quarter),
    }))
    .sort(comparePerceptors)

  sourceLines.sort(compareSourceLines)

  return {
    fiscal_year: input.fiscalYear,
    period_key: periodKey,
    currency_code: MODEL_180_CURRENCY_CODE,
    documents_included: [...includedDocumentIds].sort(),
    perceptor_count: perceptors.length,
    rent_base_cents: quarterSummaries.reduce((total, summary) => total + summary.rent_base_cents, 0),
    withholding_cents: quarterSummaries.reduce((total, summary) => total + summary.withholding_cents, 0),
    perceptors,
    quarter_summaries: quarterSummaries,
    source_lines: sourceLines,
    readiness,
  }
}
