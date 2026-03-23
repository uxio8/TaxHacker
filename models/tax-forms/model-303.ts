import type { TransactionFiscalDocument } from "../fiscal/transaction-fiscal.ts"

const MODEL_303_CURRENCY_CODE = "EUR" as const
export const MODEL_303_DRILLDOWN_BASE_PATH = "/transactions" as const
export const MODEL_303_SUPPORTED_VAT_RATE_BPS = [2100, 1000, 400] as const

type Model303TraceBucketKey =
  | "output_vat_by_rate"
  | "input_vat_deductible_by_rate"
  | "input_vat_non_deductible_by_rate"

export type Model303SupportedVatRateBps = (typeof MODEL_303_SUPPORTED_VAT_RATE_BPS)[number]

export type Model303AmountLine = {
  base_cents: number
  vat_cents: number
}

export type Model303AmountsByRate = Record<Model303SupportedVatRateBps, Model303AmountLine>

export type Model303TraceLine = {
  fiscal_document_id: string
  line_id: string
  line_number: number
  source_transaction_id: string
  source_transaction_href: string
  issue_date: string
  invoice_number: string | null
  counterparty_name: string | null
  counterparty_tax_id: string | null
  concept: string
  vat_rate_bps: Model303SupportedVatRateBps
  base_amount_cents: number
  vat_amount_cents: number
}

export type Model303TraceByRate = Record<Model303SupportedVatRateBps, Model303TraceLine[]>

export type Model303Trace = {
  output_vat_by_rate: Model303TraceByRate
  input_vat_deductible_by_rate: Model303TraceByRate
  input_vat_non_deductible_by_rate: Model303TraceByRate
}

export type Model303Draft = {
  period_key: string
  currency_code: typeof MODEL_303_CURRENCY_CODE
  documents_included: string[]
  output_vat_by_rate: Model303AmountsByRate
  input_vat_deductible_by_rate: Model303AmountsByRate
  input_vat_non_deductible_by_rate: Model303AmountsByRate
  output_vat_total_cents: number
  input_vat_deductible_total_cents: number
  input_vat_non_deductible_total_cents: number
  result_vat_payable_cents: number
  trace: Model303Trace
}

export function createEmptyModel303Draft(periodKey: string): Model303Draft {
  return {
    period_key: periodKey,
    currency_code: MODEL_303_CURRENCY_CODE,
    documents_included: [],
    output_vat_by_rate: createEmptyAmountsByRate(),
    input_vat_deductible_by_rate: createEmptyAmountsByRate(),
    input_vat_non_deductible_by_rate: createEmptyAmountsByRate(),
    output_vat_total_cents: 0,
    input_vat_deductible_total_cents: 0,
    input_vat_non_deductible_total_cents: 0,
    result_vat_payable_cents: 0,
    trace: {
      output_vat_by_rate: createEmptyTraceByRate(),
      input_vat_deductible_by_rate: createEmptyTraceByRate(),
      input_vat_non_deductible_by_rate: createEmptyTraceByRate(),
    },
  }
}

function createEmptyAmountsByRate(): Model303AmountsByRate {
  return {
    2100: { base_cents: 0, vat_cents: 0 },
    1000: { base_cents: 0, vat_cents: 0 },
    400: { base_cents: 0, vat_cents: 0 },
  }
}

function createEmptyTraceByRate(): Model303TraceByRate {
  return {
    2100: [],
    1000: [],
    400: [],
  }
}

function isSupportedVatRateBps(value: number): value is Model303SupportedVatRateBps {
  return MODEL_303_SUPPORTED_VAT_RATE_BPS.includes(value as Model303SupportedVatRateBps)
}

function assertSupportedCurrency(document: TransactionFiscalDocument) {
  if (document.header.currency_code !== MODEL_303_CURRENCY_CODE) {
    throw new Error(`Model 303 V1 solo admite currency_code=${MODEL_303_CURRENCY_CODE}`)
  }
}

function assertIssueDate(document: TransactionFiscalDocument): string {
  if (!document.header.issue_date) {
    throw new Error(
      `Model 303 requiere issue_date para el documento ${document.header.fiscal_document_id}`
    )
  }

  return document.header.issue_date
}

function compareTraceLines(left: Model303TraceLine, right: Model303TraceLine) {
  return (
    left.issue_date.localeCompare(right.issue_date) ||
    (left.invoice_number ?? "").localeCompare(right.invoice_number ?? "") ||
    left.line_number - right.line_number ||
    left.fiscal_document_id.localeCompare(right.fiscal_document_id) ||
    left.line_id.localeCompare(right.line_id)
  )
}

function resolveTraceBucket(
  document: TransactionFiscalDocument,
  deductibilityPercentBps: number
): Model303TraceBucketKey | null {
  if (document.header.document_kind === "issued_invoice" && document.header.direction === "outgoing") {
    return "output_vat_by_rate"
  }

  if (
    document.header.document_kind === "received_invoice" &&
    document.header.direction === "incoming"
  ) {
    if (deductibilityPercentBps === 10000) {
      return "input_vat_deductible_by_rate"
    }

    if (deductibilityPercentBps === 0) {
      return "input_vat_non_deductible_by_rate"
    }

    throw new Error(
      `Model 303 V1 no admite deductibility_percent_bps=${deductibilityPercentBps}`
    )
  }

  return null
}

function sumVatByRate(amountsByRate: Model303AmountsByRate) {
  return MODEL_303_SUPPORTED_VAT_RATE_BPS.reduce(
    (total, rate) => total + amountsByRate[rate].vat_cents,
    0
  )
}

export function buildModel303Draft(
  documents: TransactionFiscalDocument[],
  periodKey: string
): Model303Draft {
  const draft = createEmptyModel303Draft(periodKey)
  const outputVatByRate = draft.output_vat_by_rate
  const inputVatDeductibleByRate = draft.input_vat_deductible_by_rate
  const inputVatNonDeductibleByRate = draft.input_vat_non_deductible_by_rate
  const trace: Model303Trace = draft.trace
  const documentsIncluded = new Set<string>()

  for (const document of documents) {
    if (document.header.vat_period_assignment?.period_key !== periodKey) {
      continue
    }

    let issueDate: string | null = null

    for (const line of document.lines) {
      if (!line.is_ready_for_vat_books || line.vat_treatment !== "taxable") {
        continue
      }

      if (!isSupportedVatRateBps(line.vat_rate_bps)) {
        throw new Error(`Model 303 V1 no admite vat_rate_bps=${line.vat_rate_bps}`)
      }

      const traceBucket = resolveTraceBucket(document, line.deductibility_percent_bps)

      if (!traceBucket) {
        continue
      }

      if (!issueDate) {
        assertSupportedCurrency(document)
        issueDate = assertIssueDate(document)
      }

      const amountsByRate =
        traceBucket === "output_vat_by_rate"
          ? outputVatByRate
          : traceBucket === "input_vat_deductible_by_rate"
            ? inputVatDeductibleByRate
            : inputVatNonDeductibleByRate

      amountsByRate[line.vat_rate_bps].base_cents += line.base_amount_cents
      amountsByRate[line.vat_rate_bps].vat_cents += line.vat_amount_cents

      trace[traceBucket][line.vat_rate_bps].push({
        fiscal_document_id: document.header.fiscal_document_id,
        line_id: line.line_id,
        line_number: line.line_number,
        source_transaction_id: document.header.source_transaction_id,
        source_transaction_href: `${MODEL_303_DRILLDOWN_BASE_PATH}/${document.header.source_transaction_id}`,
        issue_date: issueDate,
        invoice_number: document.header.invoice_number,
        counterparty_name: document.header.counterparty_name,
        counterparty_tax_id: document.header.counterparty_tax_id,
        concept: line.concept,
        vat_rate_bps: line.vat_rate_bps,
        base_amount_cents: line.base_amount_cents,
        vat_amount_cents: line.vat_amount_cents,
      })

      documentsIncluded.add(document.header.fiscal_document_id)
    }
  }

  for (const rate of MODEL_303_SUPPORTED_VAT_RATE_BPS) {
    trace.output_vat_by_rate[rate].sort(compareTraceLines)
    trace.input_vat_deductible_by_rate[rate].sort(compareTraceLines)
    trace.input_vat_non_deductible_by_rate[rate].sort(compareTraceLines)
  }

  const outputVatTotalCents = sumVatByRate(outputVatByRate)
  const inputVatDeductibleTotalCents = sumVatByRate(inputVatDeductibleByRate)
  const inputVatNonDeductibleTotalCents = sumVatByRate(inputVatNonDeductibleByRate)

  return {
    ...draft,
    documents_included: [...documentsIncluded].sort(),
    output_vat_total_cents: outputVatTotalCents,
    input_vat_deductible_total_cents: inputVatDeductibleTotalCents,
    input_vat_non_deductible_total_cents: inputVatNonDeductibleTotalCents,
    result_vat_payable_cents: outputVatTotalCents - inputVatDeductibleTotalCents,
  }
}
