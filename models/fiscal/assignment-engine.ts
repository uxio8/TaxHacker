import { buildFiscalPeriodAssignment } from "./periods.ts"
import type {
  FiscalPeriodAssignment,
  TransactionFiscalHeader,
  TransactionFiscalHeaderInput,
  TransactionFiscalLine,
  TransactionFiscalLineInput,
} from "./review-status.ts"

export type TransactionFiscalAssignmentOptions = {
  vatCashAccountingEnabled?: boolean
  assignedAt?: string | Date
}

export type TransactionFiscalAssignments = Pick<
  TransactionFiscalHeader,
  "vat_period_assignment" | "withholding_period_assignment"
>

function trimToNull(value?: string | null): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
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

function normalizeAssignment(
  assignment?: FiscalPeriodAssignment | null
): FiscalPeriodAssignment | null {
  if (!assignment) {
    return null
  }

  return {
    fiscal_year: assignment.fiscal_year,
    quarter: assignment.quarter,
    period_key: assignment.period_key,
    basis: trimToNull(assignment.basis) ?? assignment.basis,
    assigned_at: trimToNull(assignment.assigned_at) ?? assignment.assigned_at,
  }
}

function normalizeHeader(
  header: Pick<
    TransactionFiscalHeaderInput,
    | "document_kind"
    | "issue_date"
    | "operation_date"
    | "payment_date"
    | "vat_period_assignment"
    | "withholding_period_assignment"
  >
) {
  return {
    document_kind: trimToNull(header.document_kind),
    issue_date: normalizeDateOnly(header.issue_date),
    operation_date: normalizeDateOnly(header.operation_date),
    payment_date: normalizeDateOnly(header.payment_date),
    vat_period_assignment: normalizeAssignment(header.vat_period_assignment),
    withholding_period_assignment: normalizeAssignment(header.withholding_period_assignment),
  }
}

function normalizeLines(
  lines: Pick<
    TransactionFiscalLineInput,
    "withholding_applicable" | "withholding_regime" | "withholding_amount_cents"
  >[]
) {
  return lines.map((line) => ({
    withholding_applicable: Boolean(line.withholding_applicable),
    withholding_regime: trimToNull(line.withholding_regime) ?? "none",
    withholding_amount_cents: Number.isInteger(line.withholding_amount_cents)
      ? (line.withholding_amount_cents as number)
      : 0,
  }))
}

function isManualOverride(assignment: FiscalPeriodAssignment | null): boolean {
  return assignment?.basis === "manual_override"
}

function isSameAssignment(
  left: FiscalPeriodAssignment | null,
  right: FiscalPeriodAssignment | null
): boolean {
  if (!left || !right) {
    return left === right
  }

  return (
    left.fiscal_year === right.fiscal_year &&
    left.quarter === right.quarter &&
    left.period_key === right.period_key &&
    left.basis === right.basis
  )
}

function buildAssignmentFromDate(
  dateOnly: string,
  basis: string,
  assignedAt: string | Date
): FiscalPeriodAssignment {
  const referenceDate = new Date(`${dateOnly}T00:00:00.000Z`)
  const fiscalYear = referenceDate.getUTCFullYear()
  const quarter = Math.floor(referenceDate.getUTCMonth() / 3) + 1

  return buildFiscalPeriodAssignment(
    {
      fiscalYear,
      quarter,
      periodKey: `${fiscalYear}-Q${quarter}`,
    },
    {
      basis,
      assignedAt,
    }
  )
}

function maybeReuseExistingAssignment(
  existing: FiscalPeriodAssignment | null,
  next: FiscalPeriodAssignment | null
): FiscalPeriodAssignment | null {
  if (!next) {
    return null
  }

  if (
    existing &&
    typeof existing.assigned_at === "string" &&
    isSameAssignment(existing, next) &&
    !isManualOverride(existing)
  ) {
    return existing
  }

  return next
}

function hasApplicableWithholding(
  lines: Pick<TransactionFiscalLine, "withholding_applicable" | "withholding_regime" | "withholding_amount_cents">[]
): boolean {
  return lines.some(
    (line) =>
      line.withholding_applicable &&
      line.withholding_regime !== "none" &&
      line.withholding_amount_cents > 0
  )
}

function resolveVatAssignment(
  header: ReturnType<typeof normalizeHeader>,
  options: TransactionFiscalAssignmentOptions
): FiscalPeriodAssignment | null {
  if (isManualOverride(header.vat_period_assignment)) {
    return header.vat_period_assignment
  }

  if (
    header.document_kind !== "issued_invoice" &&
    header.document_kind !== "received_invoice"
  ) {
    return null
  }

  const assignedAt = options.assignedAt ?? new Date()
  const candidateDate = options.vatCashAccountingEnabled
    ? header.payment_date
      ? { date: header.payment_date, basis: "payment_date" }
      : null
    : header.operation_date
      ? { date: header.operation_date, basis: "operation_date" }
      : header.issue_date
        ? { date: header.issue_date, basis: "issue_date" }
        : null

  if (!candidateDate) {
    return null
  }

  return maybeReuseExistingAssignment(
    header.vat_period_assignment,
    buildAssignmentFromDate(candidateDate.date, candidateDate.basis, assignedAt)
  )
}

function resolveWithholdingAssignment(
  header: ReturnType<typeof normalizeHeader>,
  lines: ReturnType<typeof normalizeLines>,
  options: TransactionFiscalAssignmentOptions
): FiscalPeriodAssignment | null {
  if (isManualOverride(header.withholding_period_assignment)) {
    return header.withholding_period_assignment
  }

  if (!hasApplicableWithholding(lines)) {
    return null
  }

  if (!header.payment_date) {
    return null
  }

  return maybeReuseExistingAssignment(
    header.withholding_period_assignment,
    buildAssignmentFromDate(header.payment_date, "payment_date", options.assignedAt ?? new Date())
  )
}

export function assignTransactionFiscalPeriodAssignments(
  headerInput: Pick<
    TransactionFiscalHeaderInput,
    | "document_kind"
    | "issue_date"
    | "operation_date"
    | "payment_date"
    | "vat_period_assignment"
    | "withholding_period_assignment"
  >,
  lineInputs: Pick<
    TransactionFiscalLineInput,
    "withholding_applicable" | "withholding_regime" | "withholding_amount_cents"
  >[],
  options: TransactionFiscalAssignmentOptions = {}
): TransactionFiscalAssignments {
  const header = normalizeHeader(headerInput)
  const lines = normalizeLines(lineInputs)

  return {
    vat_period_assignment: resolveVatAssignment(header, options),
    withholding_period_assignment: resolveWithholdingAssignment(header, lines, options),
  }
}
