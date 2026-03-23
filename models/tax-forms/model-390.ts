import type { TransactionFiscalDocument } from "../fiscal/transaction-fiscal.ts"
import {
  buildModel303Draft,
  MODEL_303_SUPPORTED_VAT_RATE_BPS,
  type Model303AmountsByRate,
  type Model303Draft,
  type Model303TraceLine,
} from "./model-303.ts"

export const MODEL_390_CURRENCY_CODE = "EUR" as const
export const MODEL_390_QUARTERS = [1, 2, 3, 4] as const

export type Model390Quarter = (typeof MODEL_390_QUARTERS)[number]

export type Model390QuarterSummary = {
  quarter: Model390Quarter
  period_key: string
  documents_included: string[]
  output_vat_by_rate: Model303AmountsByRate
  input_vat_deductible_by_rate: Model303AmountsByRate
  input_vat_non_deductible_by_rate: Model303AmountsByRate
  output_vat_total_cents: number
  input_vat_deductible_total_cents: number
  input_vat_non_deductible_total_cents: number
  result_vat_payable_cents: number
}

export type Model390TraceRow = {
  quarter: Model390Quarter
  period_key: string
  section: "output" | "input_deductible" | "input_non_deductible"
  line: Model303TraceLine
}

export type Model390Draft = {
  fiscal_year: number
  period_key: string
  currency_code: typeof MODEL_390_CURRENCY_CODE
  documents_included: string[]
  output_vat_by_rate: Model303AmountsByRate
  input_vat_deductible_by_rate: Model303AmountsByRate
  input_vat_non_deductible_by_rate: Model303AmountsByRate
  output_vat_total_cents: number
  input_vat_deductible_total_cents: number
  input_vat_non_deductible_total_cents: number
  result_vat_payable_cents: number
  quarter_summaries: Model390QuarterSummary[]
  trace_rows: Model390TraceRow[]
}

export type Model390DraftInput = {
  documents: TransactionFiscalDocument[]
  fiscalYear: number
}

function buildAnnualPeriodKey(fiscalYear: number) {
  return `${fiscalYear}-Y`
}

function createEmptyAmountsByRate(): Model303AmountsByRate {
  return {
    2100: { base_cents: 0, vat_cents: 0 },
    1000: { base_cents: 0, vat_cents: 0 },
    400: { base_cents: 0, vat_cents: 0 },
  }
}

function mergeAmountsByRate(target: Model303AmountsByRate, source: Model303AmountsByRate) {
  for (const rate of MODEL_303_SUPPORTED_VAT_RATE_BPS) {
    target[rate].base_cents += source[rate].base_cents
    target[rate].vat_cents += source[rate].vat_cents
  }
}

function compareTraceRows(left: Model390TraceRow, right: Model390TraceRow) {
  return (
    left.quarter - right.quarter
    || left.line.issue_date.localeCompare(right.line.issue_date)
    || (left.line.invoice_number ?? "").localeCompare(right.line.invoice_number ?? "")
    || left.line.line_number - right.line.line_number
    || left.line.fiscal_document_id.localeCompare(right.line.fiscal_document_id)
    || left.line.line_id.localeCompare(right.line.line_id)
  )
}

function buildQuarterlyDrafts(input: Model390DraftInput): Model303Draft[] {
  return MODEL_390_QUARTERS.map((quarter) =>
    buildModel303Draft(input.documents, `${input.fiscalYear}-Q${quarter}`)
  )
}

export function buildModel390Draft(input: Model390DraftInput): Model390Draft {
  const periodKey = buildAnnualPeriodKey(input.fiscalYear)
  const outputVatByRate = createEmptyAmountsByRate()
  const inputVatDeductibleByRate = createEmptyAmountsByRate()
  const inputVatNonDeductibleByRate = createEmptyAmountsByRate()
  const documentsIncluded = new Set<string>()
  const traceRows: Model390TraceRow[] = []

  const quarterSummaries = buildQuarterlyDrafts(input).map<Model390QuarterSummary>((quarterlyDraft) => {
    const quarter = Number.parseInt(quarterlyDraft.period_key.slice(-1), 10) as Model390Quarter

    for (const documentId of quarterlyDraft.documents_included) {
      documentsIncluded.add(documentId)
    }

    mergeAmountsByRate(outputVatByRate, quarterlyDraft.output_vat_by_rate)
    mergeAmountsByRate(inputVatDeductibleByRate, quarterlyDraft.input_vat_deductible_by_rate)
    mergeAmountsByRate(inputVatNonDeductibleByRate, quarterlyDraft.input_vat_non_deductible_by_rate)

    for (const rate of MODEL_303_SUPPORTED_VAT_RATE_BPS) {
      for (const line of quarterlyDraft.trace.output_vat_by_rate[rate]) {
        traceRows.push({
          quarter,
          period_key: quarterlyDraft.period_key,
          section: "output",
          line,
        })
      }

      for (const line of quarterlyDraft.trace.input_vat_deductible_by_rate[rate]) {
        traceRows.push({
          quarter,
          period_key: quarterlyDraft.period_key,
          section: "input_deductible",
          line,
        })
      }

      for (const line of quarterlyDraft.trace.input_vat_non_deductible_by_rate[rate]) {
        traceRows.push({
          quarter,
          period_key: quarterlyDraft.period_key,
          section: "input_non_deductible",
          line,
        })
      }
    }

    return {
      quarter,
      period_key: quarterlyDraft.period_key,
      documents_included: quarterlyDraft.documents_included,
      output_vat_by_rate: quarterlyDraft.output_vat_by_rate,
      input_vat_deductible_by_rate: quarterlyDraft.input_vat_deductible_by_rate,
      input_vat_non_deductible_by_rate: quarterlyDraft.input_vat_non_deductible_by_rate,
      output_vat_total_cents: quarterlyDraft.output_vat_total_cents,
      input_vat_deductible_total_cents: quarterlyDraft.input_vat_deductible_total_cents,
      input_vat_non_deductible_total_cents: quarterlyDraft.input_vat_non_deductible_total_cents,
      result_vat_payable_cents: quarterlyDraft.result_vat_payable_cents,
    }
  })

  traceRows.sort(compareTraceRows)

  const outputVatTotalCents = MODEL_303_SUPPORTED_VAT_RATE_BPS.reduce(
    (total, rate) => total + outputVatByRate[rate].vat_cents,
    0
  )
  const inputVatDeductibleTotalCents = MODEL_303_SUPPORTED_VAT_RATE_BPS.reduce(
    (total, rate) => total + inputVatDeductibleByRate[rate].vat_cents,
    0
  )
  const inputVatNonDeductibleTotalCents = MODEL_303_SUPPORTED_VAT_RATE_BPS.reduce(
    (total, rate) => total + inputVatNonDeductibleByRate[rate].vat_cents,
    0
  )

  return {
    fiscal_year: input.fiscalYear,
    period_key: periodKey,
    currency_code: MODEL_390_CURRENCY_CODE,
    documents_included: [...documentsIncluded].sort(),
    output_vat_by_rate: outputVatByRate,
    input_vat_deductible_by_rate: inputVatDeductibleByRate,
    input_vat_non_deductible_by_rate: inputVatNonDeductibleByRate,
    output_vat_total_cents: outputVatTotalCents,
    input_vat_deductible_total_cents: inputVatDeductibleTotalCents,
    input_vat_non_deductible_total_cents: inputVatNonDeductibleTotalCents,
    result_vat_payable_cents: outputVatTotalCents - inputVatDeductibleTotalCents,
    quarter_summaries: quarterSummaries,
    trace_rows: traceRows,
  }
}
