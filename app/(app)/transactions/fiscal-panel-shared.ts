import { assignTransactionFiscalPeriodAssignments } from "../../../models/fiscal/assignment-engine.ts"
import {
  FISCAL_AUDIT_EVENT_COUNTERPARTY_CONFIRMED,
  FISCAL_AUDIT_EVENT_COUNTERPARTY_CREATED_AND_LINKED,
  FISCAL_AUDIT_EVENT_COUNTERPARTY_KEPT_IN_REVIEW,
} from "../../../models/fiscal/audit-log.ts"
import { buildFiscalPeriodAssignment } from "../../../models/fiscal/periods.ts"
import type { FiscalPeriodAssignment, TransactionFiscalHeader } from "../../../models/fiscal/review-status.ts"
import type {
  TransactionFiscalDocument,
  TransactionFiscalDocumentInput,
} from "../../../models/fiscal/transaction-fiscal.ts"

const PERIOD_KEY_PATTERN = /^(\d{4})-Q([1-4])$/

export type TransactionFiscalPanelIntent =
  | "save_payment_date"
  | "override_vat_manual"
  | "reset_vat_automatic"
  | "override_withholding_manual"
  | "reset_withholding_automatic"
  | "link_counterparty"
  | "create_counterparty_and_link"
  | "keep_counterparty_in_review"

export type TransactionFiscalPanelAuditEvent =
  | typeof FISCAL_AUDIT_EVENT_COUNTERPARTY_CONFIRMED
  | typeof FISCAL_AUDIT_EVENT_COUNTERPARTY_CREATED_AND_LINKED
  | typeof FISCAL_AUDIT_EVENT_COUNTERPARTY_KEPT_IN_REVIEW

type TransactionFiscalPanelMutationInput = {
  intent: TransactionFiscalPanelIntent
  paymentDate?: string | null
  periodKey?: string | null
  counterpartyId?: string | null
  vatCashAccountingEnabled: boolean
  assignedAt?: string | Date
}

function trimToNull(value?: string | null): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function normalizeDateOnly(value?: string | null): string | null {
  const normalized = trimToNull(value)
  return normalized ? normalized.slice(0, 10) : null
}

function parsePeriodKey(periodKey: string) {
  const normalized = trimToNull(periodKey)

  if (!normalized) {
    throw new Error("El trimestre fiscal es obligatorio")
  }

  const match = PERIOD_KEY_PATTERN.exec(normalized)

  if (!match) {
    throw new Error("El trimestre fiscal debe seguir el formato YYYY-QN")
  }

  return {
    fiscalYear: Number.parseInt(match[1] as string, 10),
    quarter: Number.parseInt(match[2] as string, 10),
    periodKey: normalized,
  }
}

export function parseTransactionFiscalPanelIntent(
  value: FormDataEntryValue | null
): TransactionFiscalPanelIntent {
  const intent = trimToNull(typeof value === "string" ? value : null)

  if (
    intent === "save_payment_date" ||
    intent === "override_vat_manual" ||
    intent === "reset_vat_automatic" ||
    intent === "override_withholding_manual" ||
    intent === "reset_withholding_automatic" ||
    intent === "link_counterparty" ||
    intent === "create_counterparty_and_link" ||
    intent === "keep_counterparty_in_review"
  ) {
    return intent
  }

  throw new Error("La acción fiscal solicitada no es válida")
}

export function buildManualOverrideAssignment(
  periodKey: string,
  assignedAt: string | Date
): FiscalPeriodAssignment {
  const parsed = parsePeriodKey(periodKey)

  return buildFiscalPeriodAssignment(
    {
      fiscalYear: parsed.fiscalYear,
      quarter: parsed.quarter,
      periodKey: parsed.periodKey,
    },
    {
      basis: "manual_override",
      assignedAt,
    }
  )
}

function withHeaderMutation(
  document: TransactionFiscalDocument,
  input: TransactionFiscalPanelMutationInput
): TransactionFiscalDocumentInput["header"] {
  const assignedAt = input.assignedAt ?? new Date()
  const header: TransactionFiscalDocumentInput["header"] = {
    ...document.header,
  }
  header.payment_date = header.payment_date ?? null

  if (input.intent === "save_payment_date") {
    header.payment_date = normalizeDateOnly(input.paymentDate)
  }

  if (input.intent === "override_vat_manual") {
    if (!trimToNull(input.periodKey)) {
      throw new Error("Selecciona un trimestre para el override manual de IVA")
    }

    header.vat_period_assignment = buildManualOverrideAssignment(input.periodKey as string, assignedAt)
  }

  if (input.intent === "reset_vat_automatic") {
    header.vat_period_assignment = null
  }

  if (input.intent === "override_withholding_manual") {
    if (!trimToNull(input.periodKey)) {
      throw new Error("Selecciona un trimestre para el override manual de retenciones")
    }

    header.withholding_period_assignment = buildManualOverrideAssignment(
      input.periodKey as string,
      assignedAt
    )
  }

  if (input.intent === "reset_withholding_automatic") {
    header.withholding_period_assignment = null
  }

  if (input.intent === "link_counterparty" || input.intent === "create_counterparty_and_link") {
    const counterpartyId = trimToNull(input.counterpartyId)

    if (!counterpartyId) {
      throw new Error("Selecciona una contraparte antes de confirmar el vínculo")
    }

    header.counterparty_id = counterpartyId
  }

  const assignments = assignTransactionFiscalPeriodAssignments(header, document.lines, {
    vatCashAccountingEnabled: input.vatCashAccountingEnabled,
    assignedAt,
  })

  return {
    ...header,
    ...assignments,
  }
}

export function buildTransactionFiscalPanelDocumentInput(
  document: TransactionFiscalDocument,
  input: TransactionFiscalPanelMutationInput
): TransactionFiscalDocumentInput {
  return {
    header: withHeaderMutation(document, input),
    lines: document.lines.map((line) => ({
      ...line,
    })),
  }
}

export function buildTransactionFiscalPanelAuditReason(
  intent: TransactionFiscalPanelIntent,
  periodKey?: string | null,
  paymentDate?: string | null,
  counterpartyLabel?: string | null,
  operatorNote?: string | null
) {
  const normalizedOperatorNote = trimToNull(operatorNote)
  let reason: string

  if (intent === "save_payment_date") {
    reason = paymentDate
      ? `Panel fiscal: se fija payment_date=${paymentDate}`
      : "Panel fiscal: se vacía payment_date"
  } else if (intent === "override_vat_manual") {
    reason = `Panel fiscal: override manual de IVA a ${periodKey ?? "sin periodo"}`
  } else if (intent === "reset_vat_automatic") {
    reason = "Panel fiscal: IVA vuelve a asignación automática"
  } else if (intent === "override_withholding_manual") {
    reason = `Panel fiscal: override manual de retenciones a ${periodKey ?? "sin periodo"}`
  } else if (intent === "link_counterparty") {
    reason = `Panel fiscal: se confirma contraparte ${counterpartyLabel ?? "sin identificar"}`
  } else if (intent === "create_counterparty_and_link") {
    reason = `Panel fiscal: se crea y enlaza contraparte ${counterpartyLabel ?? "sin identificar"}`
  } else if (intent === "keep_counterparty_in_review") {
    reason = "Panel fiscal: se mantiene la resolución de contraparte en revisión"
  } else {
    reason = "Panel fiscal: retenciones vuelven a asignación automática"
  }

  return normalizedOperatorNote
    ? `${reason}. Motivo interno: ${normalizedOperatorNote}`
    : reason
}

export function getCounterpartyResolutionAuditEvent(
  intent: TransactionFiscalPanelIntent
): TransactionFiscalPanelAuditEvent | null {
  if (intent === "link_counterparty") {
    return FISCAL_AUDIT_EVENT_COUNTERPARTY_CONFIRMED
  }

  if (intent === "create_counterparty_and_link") {
    return FISCAL_AUDIT_EVENT_COUNTERPARTY_CREATED_AND_LINKED
  }

  if (intent === "keep_counterparty_in_review") {
    return FISCAL_AUDIT_EVENT_COUNTERPARTY_KEPT_IN_REVIEW
  }

  return null
}

function collectPeriodKey(
  keys: string[],
  assignment: Pick<FiscalPeriodAssignment, "period_key"> | null | undefined
) {
  if (assignment?.period_key && !keys.includes(assignment.period_key)) {
    keys.push(assignment.period_key)
  }
}

export function collectAffectedPeriodKeys(
  currentHeader: Pick<
    TransactionFiscalHeader,
    "vat_period_assignment" | "withholding_period_assignment"
  >,
  nextHeader: Pick<
    TransactionFiscalDocumentInput["header"],
    "vat_period_assignment" | "withholding_period_assignment"
  >
) {
  const keys: string[] = []

  collectPeriodKey(keys, currentHeader.vat_period_assignment)
  collectPeriodKey(keys, currentHeader.withholding_period_assignment)
  collectPeriodKey(keys, nextHeader.vat_period_assignment)
  collectPeriodKey(keys, nextHeader.withholding_period_assignment)

  return keys
}
