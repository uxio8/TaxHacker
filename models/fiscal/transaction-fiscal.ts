import {
  FISCAL_AUDIT_EVENT_FISCAL_DOCUMENT_EDITED,
  appendFiscalAuditEvent,
} from "./audit-log.ts"
import {
  assertFiscalDocumentMutationAllowed,
  getFiscalDocumentMutationLock,
} from "./close.ts"
import {
  deriveTransactionFiscalReview,
  normalizeTransactionFiscalHeader,
  type FiscalPeriodAssignment,
  type TransactionFiscalHeader,
  type TransactionFiscalHeaderInput,
  type TransactionFiscalLine,
  type TransactionFiscalLineInput,
} from "./review-status.ts"

export type TransactionFiscalDocumentInput = {
  header: TransactionFiscalHeaderInput
  lines: TransactionFiscalLineInput[]
}

export type TransactionFiscalDocument = {
  header: TransactionFiscalHeader & {
    review_status: string
    review_reasons: string[]
  }
  lines: TransactionFiscalLine[]
}

export type TransactionFiscalPersistenceOptions = {
  vatCashAccountingEnabled?: boolean
  assignedAt?: string | Date
  occurredAt?: string | Date
  auditActor?: {
    type: string
    id?: string | null
  }
  auditReason?: string | null
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
  reviewReasons: string[]
  vatPeriodAssignment: FiscalPeriodAssignment | null
  withholdingPeriodAssignment: FiscalPeriodAssignment | null
  observedAmountCents: number
  totalNetCents: number
  totalVatCents: number
  totalWithholdingCents: number
  totalGrossCents: number
  totalPayableCents: number
  sourceConfidence: string
  notes: string | null
  createdAt: Date
  updatedAt: Date
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

type TransactionFiscalStore = {
  transactionFiscal: {
    findMany?(args: {
      where: Record<string, unknown>
      include: {
        lines: {
          orderBy: {
            lineNumber: "asc"
          }
        }
      }
      orderBy: Array<Record<string, "asc" | "desc">>
    }): Promise<TransactionFiscalRecord[]>
    findFirst(args: {
      where: Record<string, unknown>
      include?: {
        lines: {
          orderBy: {
            lineNumber: "asc"
          }
        }
      }
      select?: {
        id: true
      }
    }): Promise<TransactionFiscalRecord | { id: string } | null>
    upsert(args: {
      where: {
        ownerScopeId_sourceTransactionId: {
          ownerScopeId: string
          sourceTransactionId: string
        }
      }
      update: Record<string, unknown>
      create: Record<string, unknown>
      include: {
        lines: {
          orderBy: {
            lineNumber: "asc"
          }
        }
      }
    }): Promise<TransactionFiscalRecord>
  }
  fiscalPeriod?: {
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
  }
  fiscalAuditLog?: {
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

function trimToNull(value?: string | null): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function toDateOnlyValue(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null
}

function serializeDateOnly(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null
}

function resolveAuditActor(options: TransactionFiscalPersistenceOptions) {
  return {
    type: trimToNull(options.auditActor?.type) ?? "system",
    id: trimToNull(options.auditActor?.id),
  }
}

function hasFiscalLockDependencies(
  store: TransactionFiscalStore
): store is TransactionFiscalStore & Required<Pick<TransactionFiscalStore, "fiscalPeriod" | "fiscalAuditLog">> {
  return Boolean(store.fiscalPeriod && store.fiscalAuditLog)
}

async function resolveStore(store?: TransactionFiscalStore): Promise<TransactionFiscalStore> {
  if (store) {
    return store
  }

  const { prisma } = await import("../../lib/db.ts")
  return prisma as unknown as TransactionFiscalStore
}

function buildLineWriteData(lines: TransactionFiscalLine[]) {
  return lines.map((line) => ({
    id: line.line_id,
    lineNumber: line.line_number,
    concept: line.concept,
    baseAmountCents: line.base_amount_cents,
    vatTreatment: line.vat_treatment,
    vatRateBps: line.vat_rate_bps,
    vatAmountCents: line.vat_amount_cents,
    withholdingApplicable: line.withholding_applicable,
    withholdingRegime: line.withholding_regime,
    withholdingBaseCents: line.withholding_base_cents,
    withholdingRateBps: line.withholding_rate_bps,
    withholdingAmountCents: line.withholding_amount_cents,
    deductibilityPercentBps: line.deductibility_percent_bps,
    deductibilityReason: line.deductibility_reason,
    expenseFamily: line.expense_family,
    isReadyForVatBooks: line.is_ready_for_vat_books,
    isReadyForWithholdingBooks: line.is_ready_for_withholding_books,
  }))
}

function buildTransactionFiscalPersistencePlan(
  ownerScopeId: string,
  document: TransactionFiscalDocumentInput,
  options: TransactionFiscalPersistenceOptions = {}
) {
  const normalizedOwnerScopeId = trimToNull(ownerScopeId)

  if (!normalizedOwnerScopeId) {
    throw new Error("ownerScopeId es obligatorio para persistir el fact fiscal")
  }

  const normalizedHeader = normalizeTransactionFiscalHeader(document.header)
  const review = deriveTransactionFiscalReview(normalizedHeader, document.lines, options)
  const lineWriteData = buildLineWriteData(review.lines)
  const reviewedHeader = review.header
  const nextDocument: TransactionFiscalDocument = {
    header: {
      ...reviewedHeader,
      review_status: review.review_status,
      review_reasons: review.review_reasons,
    },
    lines: review.lines,
  }

  const baseData = {
    counterpartyId: reviewedHeader.counterparty_id,
    documentKind: reviewedHeader.document_kind,
    direction: reviewedHeader.direction,
    invoiceNumber: reviewedHeader.invoice_number,
    invoiceSeries: reviewedHeader.invoice_series,
    issueDate: toDateOnlyValue(reviewedHeader.issue_date),
    operationDate: toDateOnlyValue(reviewedHeader.operation_date),
    paymentDate: toDateOnlyValue(reviewedHeader.payment_date),
    currencyCode: reviewedHeader.currency_code,
    counterpartyRole: reviewedHeader.counterparty_role,
    counterpartyName: reviewedHeader.counterparty_name,
    counterpartyTaxId: reviewedHeader.counterparty_tax_id,
    counterpartyCountryCode: reviewedHeader.counterparty_country_code,
    companyTaxId: reviewedHeader.company_tax_id,
    reviewStatus: review.review_status,
    reviewReasons: review.review_reasons,
    vatPeriodAssignment: reviewedHeader.vat_period_assignment,
    withholdingPeriodAssignment: reviewedHeader.withholding_period_assignment,
    observedAmountCents: reviewedHeader.observed_amount_cents,
    totalNetCents: reviewedHeader.total_net_cents,
    totalVatCents: reviewedHeader.total_vat_cents,
    totalWithholdingCents: reviewedHeader.total_withholding_cents,
    totalGrossCents: reviewedHeader.total_gross_cents,
    totalPayableCents: reviewedHeader.total_payable_cents,
    sourceConfidence: reviewedHeader.source_confidence,
    notes: reviewedHeader.notes,
  }

  return {
    normalizedOwnerScopeId,
    normalizedHeader,
    nextDocument,
    writeArgs: {
      where: {
        ownerScopeId_sourceTransactionId: {
          ownerScopeId: normalizedOwnerScopeId,
          sourceTransactionId: normalizedHeader.source_transaction_id,
        },
      },
      update: {
        ...baseData,
        lines: {
          deleteMany: {},
          createMany: {
            data: lineWriteData,
          },
        },
      },
      create: {
        ...baseData,
        id: normalizedHeader.fiscal_document_id,
        ownerScopeId: normalizedOwnerScopeId,
        sourceTransactionId: reviewedHeader.source_transaction_id,
        lines: {
          create: lineWriteData,
        },
      },
      include: {
        lines: {
          orderBy: { lineNumber: "asc" as const },
        },
      },
    },
  }
}

function assertStableFiscalDocumentId(
  existing: TransactionFiscalRecord | { id: string } | null,
  fiscalDocumentId: string
) {
  if (existing && existing.id !== fiscalDocumentId) {
    throw new Error(
      "No se puede cambiar el fiscal_document_id estable de un source_transaction_id existente"
    )
  }
}

function mapRecordToDocument(record: TransactionFiscalRecord): TransactionFiscalDocument {
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
      review_status: record.reviewStatus,
      review_reasons: record.reviewReasons,
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
    lines: record.lines.map((line) => ({
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
    })),
  }
}

function isTransactionFiscalRecord(
  record: TransactionFiscalRecord | { id: string } | null
): record is TransactionFiscalRecord {
  return (
    record !== null &&
    "sourceTransactionId" in record &&
    "lines" in record
  )
}

function compareTransactionFiscalRecords(left: TransactionFiscalRecord, right: TransactionFiscalRecord) {
  return left.issueDate.getTime() - right.issueDate.getTime() || left.id.localeCompare(right.id)
}

export async function upsertTransactionFiscal(
  ownerScopeId: string,
  document: TransactionFiscalDocumentInput,
  store?: TransactionFiscalStore,
  options: TransactionFiscalPersistenceOptions = {}
): Promise<TransactionFiscalDocument> {
  const db = await resolveStore(store)
  const persistencePlan = buildTransactionFiscalPersistencePlan(ownerScopeId, document, options)
  const existingRecord = await db.transactionFiscal.findFirst({
    where: {
      ownerScopeId: persistencePlan.normalizedOwnerScopeId,
      sourceTransactionId: persistencePlan.normalizedHeader.source_transaction_id,
    },
    include: {
      lines: {
        orderBy: {
          lineNumber: "asc",
        },
      },
    },
  })
  const currentDocument = isTransactionFiscalRecord(existingRecord)
    ? mapRecordToDocument(existingRecord)
    : null

  assertStableFiscalDocumentId(existingRecord, persistencePlan.normalizedHeader.fiscal_document_id)

  const mutationLock = hasFiscalLockDependencies(db)
    ? await getFiscalDocumentMutationLock(
        {
          ownerScopeId: persistencePlan.normalizedOwnerScopeId,
          fiscalDocumentId: persistencePlan.nextDocument.header.fiscal_document_id,
          currentDocument,
          nextDocument: persistencePlan.nextDocument,
        },
        db as unknown as Parameters<typeof getFiscalDocumentMutationLock>[1]
      )
    : null

  if (hasFiscalLockDependencies(db)) {
    await assertFiscalDocumentMutationAllowed(
      {
        ownerScopeId: persistencePlan.normalizedOwnerScopeId,
        fiscalDocumentId: persistencePlan.nextDocument.header.fiscal_document_id,
        currentDocument,
        nextDocument: persistencePlan.nextDocument,
        actor: resolveAuditActor(options),
        occurredAt: options.occurredAt ?? options.assignedAt,
      },
      db as unknown as Parameters<typeof assertFiscalDocumentMutationAllowed>[1]
    )
  }

  const record = await db.transactionFiscal.upsert(persistencePlan.writeArgs)

  if (
    currentDocument &&
    mutationLock?.hasSensitiveChange &&
    hasFiscalLockDependencies(db)
  ) {
    await appendFiscalAuditEvent(
      persistencePlan.normalizedOwnerScopeId,
      {
        event: FISCAL_AUDIT_EVENT_FISCAL_DOCUMENT_EDITED,
        fiscalPeriodId: mutationLock.periods[0]?.id ?? null,
        fiscalDocumentId: persistencePlan.nextDocument.header.fiscal_document_id,
        actor: resolveAuditActor(options),
        reason: trimToNull(options.auditReason),
        occurredAt: options.occurredAt ?? options.assignedAt,
      },
      db as unknown as Parameters<typeof appendFiscalAuditEvent>[2]
    )
  }

  return mapRecordToDocument(record)
}

export async function getTransactionFiscalById(
  fiscalDocumentId: string,
  ownerScopeId: string,
  store?: TransactionFiscalStore
): Promise<TransactionFiscalDocument | null> {
  const db = await resolveStore(store)
  const record = await db.transactionFiscal.findFirst({
    where: {
      id: fiscalDocumentId,
      ownerScopeId,
    },
    include: {
      lines: {
        orderBy: { lineNumber: "asc" },
      },
    },
  })

  return isTransactionFiscalRecord(record) ? mapRecordToDocument(record) : null
}

export async function getTransactionFiscalBySourceTransactionId(
  sourceTransactionId: string,
  ownerScopeId: string,
  store?: TransactionFiscalStore
): Promise<TransactionFiscalDocument | null> {
  const db = await resolveStore(store)
  const record = await db.transactionFiscal.findFirst({
    where: {
      sourceTransactionId,
      ownerScopeId,
    },
    include: {
      lines: {
        orderBy: { lineNumber: "asc" },
      },
    },
  })

  return isTransactionFiscalRecord(record) ? mapRecordToDocument(record) : null
}

export async function listTransactionFiscalDocuments(
  ownerScopeId: string,
  store?: TransactionFiscalStore
): Promise<TransactionFiscalDocument[]> {
  const normalizedOwnerScopeId = trimToNull(ownerScopeId)

  if (!normalizedOwnerScopeId) {
    throw new Error("ownerScopeId es obligatorio para listar facts fiscales")
  }

  const db = await resolveStore(store)

  if (!db.transactionFiscal.findMany) {
    throw new Error("El store fiscal no soporta listar transactionFiscal")
  }

  const records = await db.transactionFiscal.findMany({
    where: {
      ownerScopeId: normalizedOwnerScopeId,
    },
    include: {
      lines: {
        orderBy: { lineNumber: "asc" },
      },
    },
    orderBy: [{ issueDate: "asc" }, { id: "asc" }],
  })

  return [...records].sort(compareTransactionFiscalRecords).map((record) => mapRecordToDocument(record))
}
