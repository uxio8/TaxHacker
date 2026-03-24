import { normalizeCounterpartyTaxId } from "./counterparties.ts"
import {
  assignTransactionFiscalPeriodAssignments,
  type TransactionFiscalAssignmentOptions,
} from "./assignment-engine.ts"

export const TRANSACTION_FISCAL_COUNTRY_CODE = "ES" as const
export const TRANSACTION_FISCAL_CURRENCY_CODE = "EUR" as const

export const REVIEW_STATUS_PENDING = "pending" as const
export const REVIEW_STATUS_NEEDS_REVIEW = "needs_review" as const
export const REVIEW_STATUS_READY = "ready" as const
export const REVIEW_STATUS_BLOCKED = "blocked" as const

const BLOCKING_REASONS = new Set<ReviewReason>([
  "missing_vat_breakdown",
  "missing_rent_withholding",
  "employee_payroll_source_missing",
  "period_assignment_unclear",
  "manual_override_required",
  "header_totals_mismatch",
  "invalid_currency_code",
  "invalid_direction_document_kind_combo",
])

export type ReviewStatus =
  | typeof REVIEW_STATUS_PENDING
  | typeof REVIEW_STATUS_NEEDS_REVIEW
  | typeof REVIEW_STATUS_READY
  | typeof REVIEW_STATUS_BLOCKED

export type ReviewReason =
  | "missing_invoice_number"
  | "missing_counterparty_relation"
  | "missing_counterparty_tax_id"
  | "missing_vat_breakdown"
  | "mixed_tax_treatment_unresolved"
  | "missing_rent_withholding"
  | "employee_payroll_source_missing"
  | "period_assignment_unclear"
  | "manual_override_required"
  | "header_totals_mismatch"
  | "invalid_currency_code"
  | "invalid_direction_document_kind_combo"

export type CounterpartyQualityGateObligation =
  | "111_manual"
  | "115"
  | "180"
  | "347"
  | "349"

export type FiscalPeriodAssignment = {
  fiscal_year: number
  quarter: number
  period_key: string
  basis: string
  assigned_at: string
}

export type TransactionFiscalHeaderInput = {
  fiscal_document_id: string
  source_transaction_id: string
  document_kind?: string | null
  direction?: string | null
  invoice_number?: string | null
  invoice_series?: string | null
  issue_date?: string | Date | null
  operation_date?: string | Date | null
  payment_date?: string | Date | null
  currency_code?: string | null
  counterparty_id?: string | null
  counterparty_role?: string | null
  counterparty_name?: string | null
  counterparty_tax_id?: string | null
  counterparty_country_code?: string | null
  company_tax_id?: string | null
  review_status?: string | null
  review_reasons?: string[] | null
  vat_period_assignment?: FiscalPeriodAssignment | null
  withholding_period_assignment?: FiscalPeriodAssignment | null
  observed_amount_cents?: number | null
  total_net_cents?: number | null
  total_vat_cents?: number | null
  total_withholding_cents?: number | null
  total_gross_cents?: number | null
  total_payable_cents?: number | null
  source_confidence?: string | null
  notes?: string | null
}

export type TransactionFiscalLineInput = {
  line_id: string
  fiscal_document_id?: string | null
  line_number: number
  concept: string
  base_amount_cents?: number | null
  vat_treatment?: string | null
  vat_rate_bps?: number | null
  vat_amount_cents?: number | null
  withholding_applicable?: boolean | null
  withholding_regime?: string | null
  withholding_base_cents?: number | null
  withholding_rate_bps?: number | null
  withholding_amount_cents?: number | null
  deductibility_percent_bps?: number | null
  deductibility_reason?: string | null
  expense_family?: string | null
  is_ready_for_vat_books?: boolean | null
  is_ready_for_withholding_books?: boolean | null
}

export type TransactionFiscalHeader = {
  fiscal_document_id: string
  source_transaction_id: string
  document_kind: string | null
  direction: string | null
  invoice_number: string | null
  invoice_series: string | null
  issue_date: string | null
  operation_date: string | null
  payment_date: string | null
  currency_code: string | null
  counterparty_id: string | null
  counterparty_role: string
  counterparty_name: string | null
  counterparty_tax_id: string | null
  counterparty_country_code: string
  company_tax_id: string | null
  vat_period_assignment: FiscalPeriodAssignment | null
  withholding_period_assignment: FiscalPeriodAssignment | null
  observed_amount_cents: number
  total_net_cents: number
  total_vat_cents: number
  total_withholding_cents: number
  total_gross_cents: number
  total_payable_cents: number
  source_confidence: string
  notes: string | null
}

export type TransactionFiscalLine = {
  line_id: string
  fiscal_document_id: string
  line_number: number
  concept: string
  base_amount_cents: number
  vat_treatment: string
  vat_rate_bps: number
  vat_amount_cents: number
  withholding_applicable: boolean
  withholding_regime: string
  withholding_base_cents: number
  withholding_rate_bps: number
  withholding_amount_cents: number
  deductibility_percent_bps: number
  deductibility_reason: string
  expense_family: string
  is_ready_for_vat_books: boolean
  is_ready_for_withholding_books: boolean
}

export type TransactionFiscalReview = {
  header: TransactionFiscalHeader
  review_status: ReviewStatus
  review_reasons: ReviewReason[]
  ready_line_ids_for_vat_books: string[]
  ready_line_ids_for_withholding_books: string[]
  lines: TransactionFiscalLine[]
}

export type CounterpartyQualityGate = {
  blockedObligationCodes: CounterpartyQualityGateObligation[]
  blockingReasons: string[]
}

function trimToNull(value?: string | null): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function normalizeRequiredString(value: string | null | undefined, fieldName: string): string {
  const normalized = trimToNull(value)

  if (!normalized) {
    throw new Error(`El campo ${fieldName} es obligatorio`)
  }

  return normalized
}

function normalizeDateOnly(value?: string | Date | null): string | null {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  return value.slice(0, 10)
}

function normalizeInteger(value?: number | null): number {
  return Number.isInteger(value) ? (value as number) : 0
}

function dedupeReasons(reasons: ReviewReason[]): ReviewReason[] {
  return [...new Set(reasons)]
}

function dedupeObligationCodes(
  values: CounterpartyQualityGateObligation[]
): CounterpartyQualityGateObligation[] {
  return [...new Set(values)]
}

function isRentWithholdingCounterpartyTaxIdBlockingReason(
  reason: ReviewReason,
  header: TransactionFiscalHeader,
  lines: TransactionFiscalLine[]
) {
  return (
    reason === "missing_counterparty_tax_id" &&
    header.document_kind !== "payroll_placeholder" &&
    lines.some((line) => line.withholding_regime === "rent")
  )
}

function hasBlockingReasons(
  reasons: ReviewReason[],
  header: TransactionFiscalHeader,
  lines: TransactionFiscalLine[]
): boolean {
  return reasons.some(
    (reason) =>
      BLOCKING_REASONS.has(reason)
      || isRentWithholdingCounterpartyTaxIdBlockingReason(reason, header, lines)
  )
}

function matchesDirectionForDocumentKind(
  documentKind: string | null,
  direction: string | null
): boolean {
  if (!documentKind || !direction) {
    return true
  }

  if (documentKind === "issued_invoice") {
    return direction === "outgoing"
  }

  if (documentKind === "received_invoice" || documentKind === "payroll_placeholder") {
    return direction === "incoming"
  }

  return false
}

function sumLineAmounts(lines: TransactionFiscalLine[]) {
  return lines.reduce(
    (accumulator, line) => {
      accumulator.net += line.base_amount_cents
      accumulator.vat += line.vat_amount_cents
      accumulator.withholding += line.withholding_amount_cents
      return accumulator
    },
    {
      net: 0,
      vat: 0,
      withholding: 0,
    }
  )
}

function isTaxableLineComplete(line: TransactionFiscalLine): boolean {
  if (line.vat_treatment !== "taxable") {
    return false
  }

  if (line.base_amount_cents === 0) {
    return line.vat_rate_bps > 0 && line.vat_amount_cents === 0
  }

  return line.vat_rate_bps > 0 && line.vat_amount_cents > 0
}

function hasValidVatBreakdown(line: TransactionFiscalLine): boolean {
  if (line.vat_treatment === "taxable") {
    return isTaxableLineComplete(line)
  }

  if (
    line.vat_treatment === "exempt" ||
    line.vat_treatment === "non_subject" ||
    line.vat_treatment === "out_of_scope"
  ) {
    return line.vat_rate_bps === 0 && line.vat_amount_cents === 0
  }

  return false
}

function hasValidWithholdingShape(line: TransactionFiscalLine): boolean {
  if (!line.withholding_applicable) {
    return (
      line.withholding_regime === "none" &&
      line.withholding_base_cents === 0 &&
      line.withholding_rate_bps === 0 &&
      line.withholding_amount_cents === 0
    )
  }

  if (line.withholding_regime === "rent") {
    return (
      line.withholding_base_cents > 0 &&
      line.withholding_rate_bps > 0 &&
      line.withholding_amount_cents > 0
    )
  }

  if (line.withholding_regime === "salary") {
    return true
  }

  return false
}

function hasValidOutgoingDeductibility(
  direction: string | null,
  line: TransactionFiscalLine
): boolean {
  if (direction !== "outgoing") {
    return true
  }

  return (
    line.deductibility_percent_bps === 0 &&
    line.deductibility_reason === "not_applicable"
  )
}

function isLineReadyForVatBooks(
  reviewStatus: ReviewStatus,
  reviewReasons: ReviewReason[],
  header: TransactionFiscalHeader,
  lines: TransactionFiscalLine[],
  line: TransactionFiscalLine
): boolean {
  if (
    reviewStatus !== REVIEW_STATUS_READY &&
    !canKeepVatBooksReadyDespiteReview(reviewStatus, reviewReasons, header, lines)
  ) {
    return false
  }

  if (header.document_kind !== "issued_invoice" && header.document_kind !== "received_invoice") {
    return false
  }

  if (!header.vat_period_assignment) {
    return false
  }

  if (line.vat_treatment === "taxable") {
    return line.vat_rate_bps > 0
  }

  return (
    (line.vat_treatment === "exempt" ||
      line.vat_treatment === "non_subject" ||
      line.vat_treatment === "out_of_scope") &&
    line.vat_rate_bps === 0 &&
    line.vat_amount_cents === 0
  )
}

function hasWithholdingApplicableLines(lines: TransactionFiscalLine[]): boolean {
  return lines.some((line) => line.withholding_applicable)
}

function hasOutgoingDeductibilityIssue(
  header: TransactionFiscalHeader,
  lines: TransactionFiscalLine[]
): boolean {
  return lines.some((line) => !hasValidOutgoingDeductibility(header.direction, line))
}

function hasInvalidNonSalaryWithholdingShape(lines: TransactionFiscalLine[]): boolean {
  return lines.some(
    (line) =>
      line.withholding_regime !== "salary" &&
      line.withholding_applicable &&
      !hasValidWithholdingShape(line)
  )
}

function isWithholdingResolutionOnlyReason(
  reason: ReviewReason,
  header: TransactionFiscalHeader,
  lines: TransactionFiscalLine[]
): boolean {
  if (!hasWithholdingApplicableLines(lines) || header.document_kind === "payroll_placeholder") {
    return false
  }

  if (reason === "manual_override_required") {
    return (
      !header.withholding_period_assignment &&
      !header.payment_date &&
      !hasOutgoingDeductibilityIssue(header, lines) &&
      !hasInvalidNonSalaryWithholdingShape(lines)
    )
  }

  if (reason === "period_assignment_unclear") {
    return Boolean(header.vat_period_assignment) && !header.withholding_period_assignment && Boolean(header.payment_date)
  }

  return false
}

function canKeepVatBooksReadyDespiteReview(
  reviewStatus: ReviewStatus,
  reviewReasons: ReviewReason[],
  header: TransactionFiscalHeader,
  lines: TransactionFiscalLine[]
): boolean {
  return (
    reviewStatus === REVIEW_STATUS_BLOCKED &&
    reviewReasons.length > 0 &&
    Boolean(header.vat_period_assignment) &&
    reviewReasons.every((reason) => isWithholdingResolutionOnlyReason(reason, header, lines))
  )
}

function isLineReadyForWithholdingBooks(
  reviewStatus: ReviewStatus,
  header: TransactionFiscalHeader,
  line: TransactionFiscalLine
): boolean {
  return (
    reviewStatus === REVIEW_STATUS_READY &&
    line.withholding_applicable &&
    line.withholding_regime === "rent" &&
    line.withholding_base_cents > 0 &&
    line.withholding_rate_bps > 0 &&
    line.withholding_amount_cents > 0 &&
    header.withholding_period_assignment !== null
  )
}

export function normalizeTransactionFiscalHeader(
  header: TransactionFiscalHeaderInput
): TransactionFiscalHeader {
  return {
    fiscal_document_id: normalizeRequiredString(header.fiscal_document_id, "fiscal_document_id"),
    source_transaction_id: normalizeRequiredString(
      header.source_transaction_id,
      "source_transaction_id"
    ),
    document_kind: trimToNull(header.document_kind),
    direction: trimToNull(header.direction),
    invoice_number: trimToNull(header.invoice_number),
    invoice_series: trimToNull(header.invoice_series),
    issue_date: normalizeDateOnly(header.issue_date),
    operation_date: normalizeDateOnly(header.operation_date),
    payment_date: normalizeDateOnly(header.payment_date),
    currency_code: trimToNull(header.currency_code),
    counterparty_id: trimToNull(header.counterparty_id),
    counterparty_role: trimToNull(header.counterparty_role) ?? "unknown",
    counterparty_name: trimToNull(header.counterparty_name),
    counterparty_tax_id: normalizeCounterpartyTaxId(header.counterparty_tax_id),
    counterparty_country_code:
      trimToNull(header.counterparty_country_code) ?? TRANSACTION_FISCAL_COUNTRY_CODE,
    company_tax_id: normalizeCounterpartyTaxId(header.company_tax_id),
    vat_period_assignment: header.vat_period_assignment ?? null,
    withholding_period_assignment: header.withholding_period_assignment ?? null,
    observed_amount_cents: normalizeInteger(header.observed_amount_cents),
    total_net_cents: normalizeInteger(header.total_net_cents),
    total_vat_cents: normalizeInteger(header.total_vat_cents),
    total_withholding_cents: normalizeInteger(header.total_withholding_cents),
    total_gross_cents: normalizeInteger(header.total_gross_cents),
    total_payable_cents: normalizeInteger(header.total_payable_cents),
    source_confidence: trimToNull(header.source_confidence) ?? "manual",
    notes: trimToNull(header.notes),
  }
}

export function normalizeTransactionFiscalLine(
  line: TransactionFiscalLineInput,
  fiscalDocumentId: string
): TransactionFiscalLine {
  const lineFiscalDocumentId = trimToNull(line.fiscal_document_id) ?? fiscalDocumentId

  if (lineFiscalDocumentId !== fiscalDocumentId) {
    throw new Error("La linea fiscal debe apuntar a la misma cabecera fiscal")
  }

  return {
    line_id: normalizeRequiredString(line.line_id, "line_id"),
    fiscal_document_id: lineFiscalDocumentId,
    line_number: line.line_number,
    concept: normalizeRequiredString(line.concept, "concept"),
    base_amount_cents: normalizeInteger(line.base_amount_cents),
    vat_treatment: trimToNull(line.vat_treatment) ?? "out_of_scope",
    vat_rate_bps: normalizeInteger(line.vat_rate_bps),
    vat_amount_cents: normalizeInteger(line.vat_amount_cents),
    withholding_applicable: Boolean(line.withholding_applicable),
    withholding_regime: trimToNull(line.withholding_regime) ?? "none",
    withholding_base_cents: normalizeInteger(line.withholding_base_cents),
    withholding_rate_bps: normalizeInteger(line.withholding_rate_bps),
    withholding_amount_cents: normalizeInteger(line.withholding_amount_cents),
    deductibility_percent_bps: normalizeInteger(line.deductibility_percent_bps),
    deductibility_reason: trimToNull(line.deductibility_reason) ?? "not_applicable",
    expense_family: trimToNull(line.expense_family) ?? "none",
    is_ready_for_vat_books: false,
    is_ready_for_withholding_books: false,
  }
}

function deriveReviewReasons(
  header: TransactionFiscalHeader,
  lines: TransactionFiscalLine[]
): ReviewReason[] {
  const reasons: ReviewReason[] = []
  const requiresCanonicalCounterpartyLink =
    header.document_kind !== "payroll_placeholder" &&
    lines.some((line) => line.withholding_regime === "rent")

  if (header.currency_code !== TRANSACTION_FISCAL_CURRENCY_CODE) {
    reasons.push("invalid_currency_code")
  }

  if (!matchesDirectionForDocumentKind(header.document_kind, header.direction)) {
    reasons.push("invalid_direction_document_kind_combo")
  }

  if (header.document_kind === "payroll_placeholder") {
    reasons.push("employee_payroll_source_missing")
  }

  if (header.document_kind !== "payroll_placeholder" && !header.invoice_number) {
    reasons.push("missing_invoice_number")
  }

  if (requiresCanonicalCounterpartyLink && !header.counterparty_id) {
    reasons.push("missing_counterparty_relation")
  }

  if (
    header.document_kind !== "payroll_placeholder" &&
    lines.some((line) => line.withholding_regime === "rent") &&
    !header.counterparty_tax_id
  ) {
    reasons.push("missing_counterparty_tax_id")
  }

  if (
    (header.document_kind === "issued_invoice" || header.document_kind === "received_invoice") &&
    !header.vat_period_assignment
  ) {
    reasons.push("period_assignment_unclear")
  }

  const hasApplicableWithholding = lines.some((line) => line.withholding_applicable)

  if (hasApplicableWithholding && header.document_kind !== "payroll_placeholder") {
    if (!header.withholding_period_assignment && !header.payment_date) {
      reasons.push("manual_override_required")
    } else if (!header.withholding_period_assignment) {
      reasons.push("period_assignment_unclear")
    }
  }

  if (lines.some((line) => !hasValidVatBreakdown(line))) {
    reasons.push("missing_vat_breakdown")
  }

  if (lines.some((line) => !hasValidOutgoingDeductibility(header.direction, line))) {
    reasons.push("manual_override_required")
  }

  if (
    lines.some(
      (line) =>
        line.withholding_regime === "rent" &&
        (!line.withholding_applicable || !hasValidWithholdingShape(line))
    )
  ) {
    reasons.push("missing_rent_withholding")
  }

  if (
    lines.some(
      (line) =>
        line.withholding_regime !== "salary" &&
        line.withholding_applicable &&
        !hasValidWithholdingShape(line)
    )
  ) {
    reasons.push("manual_override_required")
  }

  const totals = sumLineAmounts(lines)

  if (
    header.total_net_cents !== totals.net ||
    header.total_vat_cents !== totals.vat ||
    header.total_withholding_cents !== totals.withholding ||
    header.total_gross_cents !== header.total_net_cents + header.total_vat_cents ||
    header.total_payable_cents !== header.total_gross_cents - header.total_withholding_cents
  ) {
    reasons.push("header_totals_mismatch")
  }

  if (
    header.document_kind === "payroll_placeholder" &&
    (header.total_net_cents !== 0 ||
      header.total_vat_cents !== 0 ||
      header.total_withholding_cents !== 0 ||
      header.total_gross_cents !== 0 ||
      header.total_payable_cents !== 0 ||
      header.observed_amount_cents < 0)
  ) {
    reasons.push("header_totals_mismatch")
  }

  return dedupeReasons(reasons)
}

export function getAffectedObligationsForCounterpartyReviewGate(input: {
  reviewReasons: ReviewReason[]
  counterpartyRole?: string | null
  counterpartyCountryCode?: string | null
}): CounterpartyQualityGateObligation[] {
  const obligations: CounterpartyQualityGateObligation[] = []
  const counterpartyRole = trimToNull(input.counterpartyRole)
  const counterpartyCountryCode =
    trimToNull(input.counterpartyCountryCode) ?? TRANSACTION_FISCAL_COUNTRY_CODE

  if (input.reviewReasons.includes("employee_payroll_source_missing")) {
    obligations.push("111_manual")
  }

  if (
    counterpartyRole === "landlord" ||
    input.reviewReasons.includes("missing_counterparty_relation") ||
    input.reviewReasons.includes("missing_rent_withholding")
  ) {
    obligations.push("115", "180")
  }

  if (
    input.reviewReasons.includes("missing_counterparty_tax_id") &&
    counterpartyRole !== "employee"
  ) {
    if (counterpartyRole === "landlord") {
      obligations.push("115", "180")
    } else {
      obligations.push("347")
    }
  }

  if (
    input.reviewReasons.includes("missing_counterparty_tax_id") &&
    counterpartyCountryCode !== TRANSACTION_FISCAL_COUNTRY_CODE &&
    counterpartyRole !== "employee"
  ) {
    obligations.push("349")
  }

  return dedupeObligationCodes(obligations)
}

export function deriveCounterpartyQualityGate(
  header: Pick<
    TransactionFiscalHeader,
    "counterparty_id" | "counterparty_tax_id" | "counterparty_role" | "counterparty_country_code" | "document_kind"
  >,
  lines: Array<Pick<TransactionFiscalLine, "withholding_applicable" | "withholding_regime">>
): CounterpartyQualityGate {
  const blockedObligationCodes: CounterpartyQualityGateObligation[] = []
  const blockingReasons: string[] = []
  const isInvoiceDocument =
    header.document_kind === "received_invoice" || header.document_kind === "issued_invoice"
  const hasRentWithholding = lines.some(
    (line) => line.withholding_applicable && line.withholding_regime === "rent"
  )
  const isIntraEuCounterparty =
    (trimToNull(header.counterparty_country_code) ?? TRANSACTION_FISCAL_COUNTRY_CODE) !==
    TRANSACTION_FISCAL_COUNTRY_CODE

  if (hasRentWithholding) {
    if (!trimToNull(header.counterparty_id)) {
      blockedObligationCodes.push("115", "180")
      blockingReasons.push("Falta vincular la contraparte del arrendador.")
    }

    if (!trimToNull(header.counterparty_tax_id)) {
      blockedObligationCodes.push("115", "180")
      blockingReasons.push("Falta el NIF del arrendador para retenciones y anual.")
    }
  }

  if (isInvoiceDocument && header.counterparty_role !== "employee" && !trimToNull(header.counterparty_tax_id)) {
    blockedObligationCodes.push("347")
    blockingReasons.push("Falta el NIF de la contraparte para operaciones con terceros.")
  }

  if (isInvoiceDocument && isIntraEuCounterparty && !trimToNull(header.counterparty_tax_id)) {
    blockedObligationCodes.push("349")
    blockingReasons.push("Falta el identificador fiscal intracomunitario de la contraparte.")
  }

  return {
    blockedObligationCodes: dedupeObligationCodes(blockedObligationCodes),
    blockingReasons: [...new Set(blockingReasons)],
  }
}

export function deriveTransactionFiscalReview(
  headerInput: TransactionFiscalHeaderInput,
  lineInputs: TransactionFiscalLineInput[],
  options: (TransactionFiscalAssignmentOptions & { skipAutoAssignment?: boolean }) = {}
): TransactionFiscalReview {
  const normalizedHeader = normalizeTransactionFiscalHeader(headerInput)
  const lines = lineInputs.map((line) =>
    normalizeTransactionFiscalLine(line, normalizedHeader.fiscal_document_id)
  )
  const header = options.skipAutoAssignment
    ? normalizedHeader
    : {
        ...normalizedHeader,
        ...assignTransactionFiscalPeriodAssignments(normalizedHeader, lines, options),
      }

  if (!header.document_kind || !header.direction || lines.length === 0) {
    return {
      header,
      review_status: REVIEW_STATUS_PENDING,
      review_reasons: [],
      ready_line_ids_for_vat_books: [],
      ready_line_ids_for_withholding_books: [],
      lines: lines.map((line) => ({
        ...line,
        is_ready_for_vat_books: false,
        is_ready_for_withholding_books: false,
      })),
    }
  }

  const review_reasons = deriveReviewReasons(header, lines)
  const review_status = hasBlockingReasons(review_reasons, header, lines)
    ? REVIEW_STATUS_BLOCKED
    : review_reasons.length > 0
      ? REVIEW_STATUS_NEEDS_REVIEW
      : REVIEW_STATUS_READY

  const derivedLines = lines.map((line) => {
    const is_ready_for_vat_books = isLineReadyForVatBooks(
      review_status,
      review_reasons,
      header,
      lines,
      line
    )
    const is_ready_for_withholding_books = isLineReadyForWithholdingBooks(
      review_status,
      header,
      line
    )

    return {
      ...line,
      is_ready_for_vat_books,
      is_ready_for_withholding_books,
    }
  })

  return {
    header,
    review_status,
    review_reasons,
    ready_line_ids_for_vat_books: derivedLines
      .filter((line) => line.is_ready_for_vat_books)
      .map((line) => line.line_id),
    ready_line_ids_for_withholding_books: derivedLines
      .filter((line) => line.is_ready_for_withholding_books)
      .map((line) => line.line_id),
    lines: derivedLines,
  }
}
