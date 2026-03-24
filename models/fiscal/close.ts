import {
  FISCAL_AUDIT_EVENT_FISCAL_DOCUMENT_EDIT_BLOCKED,
  FISCAL_AUDIT_EVENT_PERIOD_CLOSED,
  FISCAL_AUDIT_EVENT_PERIOD_REOPENED,
  appendFiscalAuditEvent,
} from "./audit-log.ts"
import {
  FISCAL_PERIOD_STATUS_CLOSED,
  FISCAL_PERIOD_STATUS_IN_REVIEW,
  FISCAL_PERIOD_STATUS_PRESENTED,
  ensureFiscalPeriod,
  getFiscalPeriodByKey,
  type FiscalPeriod,
} from "./periods.ts"
import {
  REVIEW_STATUS_BLOCKED,
  REVIEW_STATUS_NEEDS_REVIEW,
  REVIEW_STATUS_PENDING,
  REVIEW_STATUS_READY,
  type FiscalPeriodAssignment,
  type ReviewStatus,
  type TransactionFiscalLine,
} from "./review-status.ts"
import {
  getLatestFiscalPeriodSnapshot,
  replaceFiscalPeriodSnapshot,
} from "./snapshots.ts"
import { withFiscalStorageGuard } from "./storage.ts"
import type { TransactionFiscalDocument } from "./transaction-fiscal.ts"
import { buildQuarterlyDraft } from "./quarterly-draft.ts"
import { buildVatBooks } from "./vat-books.ts"
import { buildModel303Draft } from "../tax-forms/model-303.ts"
import { buildModel115Draft } from "../tax-forms/model-115.ts"

type FiscalProfileSummary = {
  id: string
  companyName: string
  taxId: string
}

type CloseFiscalPeriodInput = {
  ownerScopeId: string
  fiscalProfile: FiscalProfileSummary
  periodKey: string
  occurredAt?: string | Date | null
}

type ReopenFiscalPeriodInput = {
  ownerScopeId: string
  fiscalProfile: FiscalProfileSummary
  periodKey: string
  reason: string
  occurredAt?: string | Date | null
}

type TransactionFiscalRecord = {
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
  lines: TransactionFiscalLineRecord[]
}

type TransactionFiscalLineRecord = {
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
  createdAt: Date
  updatedAt: Date
}

type CloseStore = {
  fiscalPeriod: {
    findUnique(args: {
      where: {
        ownerScopeId_periodKey?: {
          ownerScopeId: string
          periodKey: string
        }
        ownerScopeId_fiscalYear_quarter?: {
          ownerScopeId: string
          fiscalYear: number
          quarter: number
        }
      }
    }): Promise<{
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
    } | null>
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
    }): Promise<unknown>
  }
  transactionFiscal: {
    findMany(args: {
      where: {
        ownerScopeId: string
      }
      include?: {
        lines: {
          orderBy: {
            lineNumber: "asc"
          }
        }
      }
      orderBy?: Array<Record<string, "asc" | "desc">>
    }): Promise<TransactionFiscalRecord[]>
  }
  fiscalPeriodSnapshot: {
    findUnique(args: {
      where: {
        ownerScopeId_fiscalPeriodId_snapshotKind: {
          ownerScopeId: string
          fiscalPeriodId: string
          snapshotKind: string
        }
      }
    }): Promise<unknown>
    findFirst(args: {
      where: {
        ownerScopeId: string
        fiscalPeriodId: string
        snapshotKind?: string
      }
      orderBy?: {
        updatedAt: "asc" | "desc"
      }
    }): Promise<unknown>
    upsert(args: {
      where: {
        ownerScopeId_fiscalPeriodId_snapshotKind: {
          ownerScopeId: string
          fiscalPeriodId: string
          snapshotKind: string
        }
      }
      update: {
        schemaVersion: number
        payloadHash: string
        generatedAt: Date
        payload: unknown
      }
      create: {
        ownerScopeId: string
        fiscalPeriodId: string
        snapshotKind: string
        schemaVersion: number
        payloadHash: string
        generatedAt: Date
        payload: unknown
      }
    }): Promise<unknown>
  }
  fiscalAuditLog: {
    create(args: {
      data: {
        ownerScopeId: string
        fiscalPeriodId: string | null
        fiscalDocumentId: string | null
        event: string
        schemaVersion: number
        payload: unknown
        occurredAt: Date
      }
    }): Promise<unknown>
  }
}

type CloseFiscalPeriodResult = {
  period: FiscalPeriod
  snapshot: Awaited<ReturnType<typeof replaceFiscalPeriodSnapshot>>
}

type ReopenFiscalPeriodResult = {
  previousStatus: string
  period: FiscalPeriod
  reason: string
}

type FiscalMutationActor = {
  type: string
  id?: string | null
}

type FiscalDocumentMutationLockInput = {
  ownerScopeId: string
  fiscalDocumentId?: string | null
  currentDocument?: TransactionFiscalDocument | null
  nextDocument?: TransactionFiscalDocument | null
}

type AssertFiscalDocumentMutationAllowedInput = FiscalDocumentMutationLockInput & {
  actor: FiscalMutationActor
  occurredAt?: string | Date | null
}

type FiscalDocumentMutationPeriod = {
  id: string
  periodKey: string
  status: FiscalPeriod["status"]
  locked: boolean
}

type FiscalDocumentMutationLock = {
  fiscalDocumentId: string | null
  affectedPeriodKeys: string[]
  hasSensitiveChange: boolean
  locked: boolean
  periods: FiscalDocumentMutationPeriod[]
  message: string | null
}

const REVIEW_STATUSES: ReviewStatus[] = [
  REVIEW_STATUS_READY,
  REVIEW_STATUS_NEEDS_REVIEW,
  REVIEW_STATUS_BLOCKED,
  REVIEW_STATUS_PENDING,
]

function trimToNull(value?: string | null): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function normalizeOwnerScopeId(ownerScopeId: string): string {
  const normalized = trimToNull(ownerScopeId)

  if (!normalized) {
    throw new Error("ownerScopeId es obligatorio para cerrar el periodo fiscal")
  }

  return normalized
}

function normalizePeriodKey(periodKey: string): string {
  const normalized = trimToNull(periodKey)

  if (!normalized) {
    throw new Error("periodKey es obligatorio")
  }

  return normalized
}

function normalizeReason(reason: string): string {
  const normalized = trimToNull(reason)

  if (!normalized) {
    throw new Error("reason es obligatorio")
  }

  return normalized
}

function normalizeOccurredAt(value?: string | Date | null): string {
  if (!value) {
    return new Date().toISOString()
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error("occurredAt debe ser una fecha valida")
    }

    return value.toISOString()
  }

  const normalized = trimToNull(value)

  if (!normalized) {
    return new Date().toISOString()
  }

  const parsed = new Date(normalized)

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("occurredAt debe ser una fecha ISO valida")
  }

  return parsed.toISOString()
}

function assertFiscalProfileOwnership(ownerScopeId: string, fiscalProfile: FiscalProfileSummary) {
  if (trimToNull(fiscalProfile.id) !== ownerScopeId) {
    throw new Error("fiscalProfile.id debe coincidir con el ownerScopeId")
  }
}

function serializeDateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null
}

function serializeAssignmentFingerprint(assignment: FiscalPeriodAssignment | null): string {
  if (!assignment) {
    return "null"
  }

  return JSON.stringify({
    fiscal_year: assignment.fiscal_year,
    quarter: assignment.quarter,
    period_key: assignment.period_key,
    basis: assignment.basis,
  })
}

function serializeSensitiveLineFingerprint(line: TransactionFiscalDocument["lines"][number]): string {
  return JSON.stringify({
    line_id: line.line_id,
    line_number: line.line_number,
    base_amount_cents: line.base_amount_cents,
    vat_treatment: line.vat_treatment,
    vat_rate_bps: line.vat_rate_bps,
    vat_amount_cents: line.vat_amount_cents,
    withholding_applicable: line.withholding_applicable,
    withholding_regime: line.withholding_regime,
    withholding_base_cents: line.withholding_base_cents,
    withholding_rate_bps: line.withholding_rate_bps,
    withholding_amount_cents: line.withholding_amount_cents,
    deductibility_percent_bps: line.deductibility_percent_bps,
    is_ready_for_vat_books: line.is_ready_for_vat_books,
    is_ready_for_withholding_books: line.is_ready_for_withholding_books,
  })
}

function buildSensitiveDocumentFingerprint(document?: TransactionFiscalDocument | null): string {
  if (!document) {
    return "null"
  }

  return JSON.stringify({
    document_kind: document.header.document_kind,
    direction: document.header.direction,
    review_status: document.header.review_status,
    vat_period_assignment: serializeAssignmentFingerprint(document.header.vat_period_assignment),
    withholding_period_assignment: serializeAssignmentFingerprint(
      document.header.withholding_period_assignment
    ),
    observed_amount_cents: document.header.observed_amount_cents,
    total_net_cents: document.header.total_net_cents,
    total_vat_cents: document.header.total_vat_cents,
    total_withholding_cents: document.header.total_withholding_cents,
    total_gross_cents: document.header.total_gross_cents,
    total_payable_cents: document.header.total_payable_cents,
    lines: [...document.lines]
      .sort((left, right) => left.line_number - right.line_number || left.line_id.localeCompare(right.line_id))
      .map(serializeSensitiveLineFingerprint),
  })
}

function hasSensitiveFiscalDocumentChange(
  currentDocument?: TransactionFiscalDocument | null,
  nextDocument?: TransactionFiscalDocument | null
): boolean {
  return (
    buildSensitiveDocumentFingerprint(currentDocument) !==
    buildSensitiveDocumentFingerprint(nextDocument)
  )
}

function collectAffectedPeriodKeys(
  document?: TransactionFiscalDocument | null
): string[] {
  if (!document) {
    return []
  }

  return [
    document.header.vat_period_assignment?.period_key ?? null,
    document.header.withholding_period_assignment?.period_key ?? null,
  ].filter((periodKey): periodKey is string => Boolean(periodKey))
}

function formatLockedMutationMessage(fiscalDocumentId: string | null, periodKeys: string[]): string {
  const normalizedPeriodKeys = [...new Set(periodKeys)].sort()
  const documentLabel = fiscalDocumentId ?? "sin_id"

  return `No se puede modificar el documento fiscal ${documentLabel} porque afecta a periodos cerrados o presentados (${normalizedPeriodKeys.join(", ")}). Reabre el periodo antes de cambiar asignaciones o importes fiscales.`
}

export function isFiscalPeriodLocked(status: string | null | undefined): boolean {
  return (
    status === FISCAL_PERIOD_STATUS_CLOSED ||
    status === FISCAL_PERIOD_STATUS_PRESENTED
  )
}

function mapReviewStatus(status: string): ReviewStatus {
  return REVIEW_STATUSES.includes(status as ReviewStatus)
    ? (status as ReviewStatus)
    : REVIEW_STATUS_PENDING
}

function mapReviewReasons(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []
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

function mapTransactionFiscalLineRecord(record: TransactionFiscalLineRecord): TransactionFiscalLine {
  return {
    line_id: record.id,
    fiscal_document_id: record.transactionFiscalId,
    line_number: record.lineNumber,
    concept: record.concept,
    base_amount_cents: record.baseAmountCents,
    vat_treatment: record.vatTreatment,
    vat_rate_bps: record.vatRateBps,
    vat_amount_cents: record.vatAmountCents,
    withholding_applicable: record.withholdingApplicable,
    withholding_regime: record.withholdingRegime,
    withholding_base_cents: record.withholdingBaseCents,
    withholding_rate_bps: record.withholdingRateBps,
    withholding_amount_cents: record.withholdingAmountCents,
    deductibility_percent_bps: record.deductibilityPercentBps,
    deductibility_reason: record.deductibilityReason,
    expense_family: record.expenseFamily,
    is_ready_for_vat_books: record.isReadyForVatBooks,
    is_ready_for_withholding_books: record.isReadyForWithholdingBooks,
  }
}

export function mapTransactionFiscalRecordForClose(
  record: TransactionFiscalRecord
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
      review_status: mapReviewStatus(record.reviewStatus),
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
    lines: record.lines.map(mapTransactionFiscalLineRecord),
  }
}

async function listTransactionDocuments(
  ownerScopeId: string,
  store: CloseStore
): Promise<TransactionFiscalDocument[]> {
  const records = await store.transactionFiscal.findMany({
    where: {
      ownerScopeId,
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

  return records.map(mapTransactionFiscalRecordForClose)
}

function assertCloseableDraft(
  periodKey: string,
  reviewStatusCounts: Record<ReviewStatus, number>
) {
  if (
    reviewStatusCounts[REVIEW_STATUS_NEEDS_REVIEW] > 0 ||
    reviewStatusCounts[REVIEW_STATUS_BLOCKED] > 0 ||
    reviewStatusCounts[REVIEW_STATUS_PENDING] > 0
  ) {
    throw new Error(
      `No se puede cerrar el periodo ${periodKey} porque hay documentos inconsistentes o pendientes de revision`
    )
  }
}

async function loadExistingPeriodOrThrow(
  ownerScopeId: string,
  periodKey: string,
  store: CloseStore
): Promise<FiscalPeriod> {
  const period = await getFiscalPeriodByKey(
    ownerScopeId,
    periodKey,
    store as Parameters<typeof getFiscalPeriodByKey>[2]
  )

  if (!period) {
    throw new Error(`No existe el periodo ${periodKey} para ${ownerScopeId}`)
  }

  if (period.ownerScopeId !== ownerScopeId) {
    throw new Error("El periodo fiscal pertenece a otro ownerScopeId")
  }

  return period
}

export async function getFiscalDocumentMutationLock(
  input: FiscalDocumentMutationLockInput,
  store?: CloseStore
): Promise<FiscalDocumentMutationLock> {
  return withFiscalStorageGuard(async () => {
    const db = store ?? ((await import("../../lib/db.ts")).prisma as unknown as CloseStore)
    const ownerScopeId = normalizeOwnerScopeId(input.ownerScopeId)
    const fiscalDocumentId =
      trimToNull(input.fiscalDocumentId) ??
      trimToNull(input.currentDocument?.header.fiscal_document_id) ??
      trimToNull(input.nextDocument?.header.fiscal_document_id)
    const hasSensitiveChange = hasSensitiveFiscalDocumentChange(
      input.currentDocument,
      input.nextDocument
    )

    if (!hasSensitiveChange) {
      return {
        fiscalDocumentId,
        affectedPeriodKeys: [],
        hasSensitiveChange,
        locked: false,
        periods: [],
        message: null,
      }
    }

    const affectedPeriodKeys = [
      ...new Set([
        ...collectAffectedPeriodKeys(input.currentDocument),
        ...collectAffectedPeriodKeys(input.nextDocument),
      ]),
    ].sort()
    const periods: FiscalDocumentMutationPeriod[] = []

    for (const periodKey of affectedPeriodKeys) {
      const period = await getFiscalPeriodByKey(
        ownerScopeId,
        periodKey,
        db as Parameters<typeof getFiscalPeriodByKey>[2]
      )

      if (!period) {
        continue
      }

      periods.push({
        id: period.id,
        periodKey: period.periodKey,
        status: period.status,
        locked: isFiscalPeriodLocked(period.status),
      })
    }

    const lockedPeriods = periods.filter((period) => period.locked)

    return {
      fiscalDocumentId,
      affectedPeriodKeys,
      hasSensitiveChange,
      locked: lockedPeriods.length > 0,
      periods,
      message:
        lockedPeriods.length > 0
          ? formatLockedMutationMessage(
              fiscalDocumentId,
              lockedPeriods.map((period) => period.periodKey)
            )
          : null,
    }
  })
}

export async function assertFiscalDocumentMutationAllowed(
  input: AssertFiscalDocumentMutationAllowedInput,
  store?: CloseStore
): Promise<void> {
  const db = store ?? ((await import("../../lib/db.ts")).prisma as unknown as CloseStore)
  const mutationLock = await getFiscalDocumentMutationLock(input, db)

  if (!mutationLock.locked) {
    return
  }

  await appendFiscalAuditEvent(
    normalizeOwnerScopeId(input.ownerScopeId),
    {
      event: FISCAL_AUDIT_EVENT_FISCAL_DOCUMENT_EDIT_BLOCKED,
      fiscalPeriodId: mutationLock.periods.find((period) => period.locked)?.id ?? null,
      fiscalDocumentId: mutationLock.fiscalDocumentId,
      actor: input.actor,
      reason: mutationLock.message,
      occurredAt: input.occurredAt,
    },
    db as unknown as Parameters<typeof appendFiscalAuditEvent>[2]
  )

  throw new Error(mutationLock.message ?? "El documento fiscal esta bloqueado por cierre")
}

export async function closeFiscalPeriod(
  input: CloseFiscalPeriodInput,
  store?: CloseStore
): Promise<CloseFiscalPeriodResult> {
  return withFiscalStorageGuard(async () => {
    const db = store ?? ((await import("../../lib/db.ts")).prisma as unknown as CloseStore)
    const ownerScopeId = normalizeOwnerScopeId(input.ownerScopeId)
    const periodKey = normalizePeriodKey(input.periodKey)
    const occurredAt = normalizeOccurredAt(input.occurredAt)

    assertFiscalProfileOwnership(ownerScopeId, input.fiscalProfile)

    const existingPeriod = await loadExistingPeriodOrThrow(ownerScopeId, periodKey, db)

    if (existingPeriod.status === FISCAL_PERIOD_STATUS_CLOSED) {
      const existingSnapshot = await getLatestFiscalPeriodSnapshot(
        ownerScopeId,
        existingPeriod.id,
        undefined,
        db as Parameters<typeof getLatestFiscalPeriodSnapshot>[3]
      )

      if (existingSnapshot) {
        return {
          period: existingPeriod,
          snapshot: existingSnapshot,
        }
      }
    }

    const period = await ensureFiscalPeriod(
      ownerScopeId,
      {
        fiscalYear: existingPeriod.fiscalYear,
        quarter: existingPeriod.quarter,
        status: FISCAL_PERIOD_STATUS_CLOSED,
      },
      db as Parameters<typeof ensureFiscalPeriod>[2]
    )

    const documents = await listTransactionDocuments(ownerScopeId, db)
    const draft = buildQuarterlyDraft(period, documents)
    assertCloseableDraft(period.periodKey, draft.reviewStatusCounts)

    const periodDocumentIds = new Set(draft.documents.map((document) => document.fiscalDocumentId))
    const periodDocuments = documents.filter((document) =>
      periodDocumentIds.has(document.header.fiscal_document_id)
    )
    const vatBooks = buildVatBooks(periodDocuments)
    const model303 = buildModel303Draft(periodDocuments, period.periodKey)
    const model115 = buildModel115Draft({
      documents: periodDocuments,
      fiscalYear: period.fiscalYear,
      quarter: period.quarter,
    })
    const snapshot = await replaceFiscalPeriodSnapshot(
      ownerScopeId,
      {
        period,
        company: {
          companyName: input.fiscalProfile.companyName,
          companyTaxId: input.fiscalProfile.taxId,
        },
        summary: {
          review_status_counts: draft.reviewStatusCounts,
          model_303: model303,
          model_115: model115,
        },
        vatBooks,
        generatedAt: occurredAt,
      },
      db as Parameters<typeof replaceFiscalPeriodSnapshot>[2]
    )

    if (existingPeriod.status !== FISCAL_PERIOD_STATUS_CLOSED) {
      await appendFiscalAuditEvent(
        ownerScopeId,
        {
          event: FISCAL_AUDIT_EVENT_PERIOD_CLOSED,
          fiscalPeriodId: period.id,
          actor: {
            type: "system",
            id: null,
          },
          reason: null,
          occurredAt,
        },
        db as unknown as Parameters<typeof appendFiscalAuditEvent>[2]
      )
    }

    return {
      period,
      snapshot,
    }
  })
}

export async function reopenFiscalPeriod(
  input: ReopenFiscalPeriodInput,
  store?: CloseStore
): Promise<ReopenFiscalPeriodResult> {
  return withFiscalStorageGuard(async () => {
    const db = store ?? ((await import("../../lib/db.ts")).prisma as unknown as CloseStore)
    const ownerScopeId = normalizeOwnerScopeId(input.ownerScopeId)
    const periodKey = normalizePeriodKey(input.periodKey)
    const reason = normalizeReason(input.reason)
    const occurredAt = normalizeOccurredAt(input.occurredAt)

    assertFiscalProfileOwnership(ownerScopeId, input.fiscalProfile)

    const existingPeriod = await loadExistingPeriodOrThrow(ownerScopeId, periodKey, db)

    if (
      existingPeriod.status !== FISCAL_PERIOD_STATUS_CLOSED &&
      existingPeriod.status !== FISCAL_PERIOD_STATUS_PRESENTED
    ) {
      throw new Error(
        `Solo se puede reabrir un periodo ${FISCAL_PERIOD_STATUS_CLOSED} o ${FISCAL_PERIOD_STATUS_PRESENTED}`
      )
    }

    const period = await ensureFiscalPeriod(
      ownerScopeId,
      {
        fiscalYear: existingPeriod.fiscalYear,
        quarter: existingPeriod.quarter,
        status: FISCAL_PERIOD_STATUS_IN_REVIEW,
      },
      db as Parameters<typeof ensureFiscalPeriod>[2]
    )

    await appendFiscalAuditEvent(
      ownerScopeId,
      {
        event: FISCAL_AUDIT_EVENT_PERIOD_REOPENED,
        fiscalPeriodId: period.id,
        actor: {
          type: "system",
          id: null,
        },
        reason,
        occurredAt,
      },
      db as unknown as Parameters<typeof appendFiscalAuditEvent>[2]
    )

    return {
      previousStatus: existingPeriod.status,
      period,
      reason,
    }
  })
}
