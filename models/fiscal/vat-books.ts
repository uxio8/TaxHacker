import type { TransactionFiscalDocument } from "./transaction-fiscal.ts"

export const VAT_BOOK_KIND = {
  RECEIVED: "received",
  ISSUED: "issued",
} as const

export type VatBookKind = (typeof VAT_BOOK_KIND)[keyof typeof VAT_BOOK_KIND]

export type VatBookLine = {
  book_kind: VatBookKind
  fiscal_document_id: string
  line_id: string
  line_number: number
  issue_date: string
  invoice_number: string | null
  counterparty_id: string | null
  counterparty_name: string | null
  counterparty_tax_id: string | null
  concept: string
  base_amount_cents: number
  vat_rate_bps: number
  vat_amount_cents: number
  deductibility_percent_bps: number
  deductible_vat_cents: number
}

export type VatBooks = {
  received: VatBookLine[]
  issued: VatBookLine[]
}

const V1_CURRENCY_CODE = "EUR" as const

function resolveVatBookKind(document: TransactionFiscalDocument): VatBookKind | null {
  if (
    document.header.document_kind === "received_invoice" &&
    document.header.direction === "incoming"
  ) {
    return VAT_BOOK_KIND.RECEIVED
  }

  if (
    document.header.document_kind === "issued_invoice" &&
    document.header.direction === "outgoing"
  ) {
    return VAT_BOOK_KIND.ISSUED
  }

  return null
}

function assertSupportedCurrency(document: TransactionFiscalDocument) {
  if (document.header.currency_code !== V1_CURRENCY_CODE) {
    throw new Error(`VAT Books V1 solo admite currency_code=${V1_CURRENCY_CODE}`)
  }
}

function assertIssueDate(document: TransactionFiscalDocument): string {
  if (!document.header.issue_date) {
    throw new Error(
      `VAT Books requiere issue_date para el documento ${document.header.fiscal_document_id}`
    )
  }

  return document.header.issue_date
}

function calculateDeductibleVatCents(vatAmountCents: number, deductibilityPercentBps: number) {
  if (vatAmountCents === 0 || deductibilityPercentBps === 0) {
    return 0
  }

  if (deductibilityPercentBps === 10000) {
    return vatAmountCents
  }

  return Math.round((vatAmountCents * deductibilityPercentBps) / 10000)
}

function compareVatBookLines(left: VatBookLine, right: VatBookLine) {
  return (
    left.issue_date.localeCompare(right.issue_date) ||
    (left.invoice_number ?? "").localeCompare(right.invoice_number ?? "") ||
    left.line_number - right.line_number ||
    left.fiscal_document_id.localeCompare(right.fiscal_document_id) ||
    left.line_id.localeCompare(right.line_id)
  )
}

function buildVatBookLinesForKind(
  documents: TransactionFiscalDocument[],
  bookKind: VatBookKind
): VatBookLine[] {
  const lines: VatBookLine[] = []

  for (const document of documents) {
    const resolvedBookKind = resolveVatBookKind(document)

    if (resolvedBookKind !== bookKind) {
      continue
    }

    assertSupportedCurrency(document)
    const issueDate = assertIssueDate(document)

    for (const line of document.lines) {
      if (!line.is_ready_for_vat_books) {
        continue
      }

      lines.push({
        book_kind: bookKind,
        fiscal_document_id: document.header.fiscal_document_id,
        line_id: line.line_id,
        line_number: line.line_number,
        issue_date: issueDate,
        invoice_number: document.header.invoice_number,
        counterparty_id: document.header.counterparty_id,
        counterparty_name: document.header.counterparty_name,
        counterparty_tax_id: document.header.counterparty_tax_id,
        concept: line.concept,
        base_amount_cents: line.base_amount_cents,
        vat_rate_bps: line.vat_rate_bps,
        vat_amount_cents: line.vat_amount_cents,
        deductibility_percent_bps: line.deductibility_percent_bps,
        deductible_vat_cents: calculateDeductibleVatCents(
          line.vat_amount_cents,
          line.deductibility_percent_bps
        ),
      })
    }
  }

  return lines.sort(compareVatBookLines)
}

export function buildReceivedVatBookLines(documents: TransactionFiscalDocument[]): VatBookLine[] {
  return buildVatBookLinesForKind(documents, VAT_BOOK_KIND.RECEIVED)
}

export function buildIssuedVatBookLines(documents: TransactionFiscalDocument[]): VatBookLine[] {
  return buildVatBookLinesForKind(documents, VAT_BOOK_KIND.ISSUED)
}

export function buildVatBooks(documents: TransactionFiscalDocument[]): VatBooks {
  return {
    received: buildReceivedVatBookLines(documents),
    issued: buildIssuedVatBookLines(documents),
  }
}
