import {
  FISCAL_PERIOD_STATUS_CLOSED,
  FISCAL_PERIOD_STATUS_IN_REVIEW,
  FISCAL_PERIOD_STATUS_OPEN,
  FISCAL_PERIOD_STATUS_PRESENTED,
  FISCAL_PERIOD_STATUS_READY,
  type FiscalPeriod,
  type FiscalPeriodStatus,
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
import type { TransactionFiscalDocument } from "./transaction-fiscal.ts"
import { getFiscalFilingDossierByObligationId, type FiscalFilingDossier } from "./filing-dossiers.ts"
import { withFiscalStorageGuard } from "./storage.ts"

export const LEGAL_ARCHIVE_MANIFEST_VERSION = 1 as const

export const LEGAL_ARCHIVE_ATTACHMENT_STATUS = {
  AVAILABLE: "available",
  MISSING: "missing",
} as const

export type LegalArchiveAttachmentStatus =
  (typeof LEGAL_ARCHIVE_ATTACHMENT_STATUS)[keyof typeof LEGAL_ARCHIVE_ATTACHMENT_STATUS]

export type LegalArchiveAttachmentInput = {
  id: string
  filename: string
  mediaType?: string | null
  byteSize?: number | null
  createdAt?: string | null
}

export type LegalArchiveAttachment = {
  id: string
  filename: string
  mediaType: string | null
  byteSize: number | null
  createdAt: string | null
}

export type LegalArchiveAttachmentMap = Record<string, LegalArchiveAttachmentInput[]>

export type LegalArchiveManifestPeriod = {
  fiscalYear: number
  quarter: number
  periodKey: string
  startsOn: string
  endsOn: string
  status: FiscalPeriodStatus
}

export type LegalArchiveManifestTotals = {
  expectedSourceCount: number
  availableSourceCount: number
  missingSourceCount: number
  attachmentCount: number
  unexpectedSourceCount: number
  unexpectedAttachmentCount: number
}

export type LegalArchiveExpectedSource = {
  sourceTransactionId: string
  fiscalDocumentId: string
  documentKind: string | null
  issueDate: string | null
  reviewStatus: ReviewStatus
  reviewReasons: string[]
  includesVat: boolean
  includesWithholding: boolean
  expectedAttachmentCount: number
  availableAttachmentCount: number
  attachmentStatus: LegalArchiveAttachmentStatus
  attachments: LegalArchiveAttachment[]
}

export type LegalArchiveUnexpectedSource = {
  sourceTransactionId: string
  attachmentCount: number
  attachments: LegalArchiveAttachment[]
}

export type LegalArchiveManifest = {
  manifestVersion: typeof LEGAL_ARCHIVE_MANIFEST_VERSION
  period: LegalArchiveManifestPeriod
  totals: LegalArchiveManifestTotals
  sources: LegalArchiveExpectedSource[]
  unexpectedSources: LegalArchiveUnexpectedSource[]
  filings: LegalArchiveFiling[]
}

export type LegalArchiveAttachmentResolution = {
  referencedAttachmentCount: number
  resolvedAttachmentCount: number
  unresolvedAttachmentCount: number
}

export type LegalArchiveUnresolvedSource = {
  sourceTransactionId: string
  referencedAttachmentCount: number
  resolvedAttachmentCount: number
  unresolvedAttachmentCount: number
}

export type LegalArchivePeriodListItem = {
  period: FiscalPeriod
  manifest: LegalArchiveManifest
  attachmentResolution: LegalArchiveAttachmentResolution
}

export type LegalArchivePeriodDetail = {
  period: FiscalPeriod
  manifest: LegalArchiveManifest
  attachmentResolution: LegalArchiveAttachmentResolution
  unresolvedSources: LegalArchiveUnresolvedSource[]
}

export type LegalArchiveFiling = {
  obligationId: string
  code: string
  periodKey: string
  status: string
  dueDate: string | null
  owner: string
  hasDraftSnapshot: boolean
  draftSnapshot: unknown
  filingReference: string | null
  filedAt: string | null
  filingNotes: string | null
  requiredEvidence: string[]
  attachedEvidence: string[]
  missingEvidence: string[]
  filingReceipt: LegalArchiveAttachment | null
}

type LegalArchiveFiscalPeriodRecord = {
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
}

type LegalArchiveTransactionFiscalLineRecord = {
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
}

type LegalArchiveTransactionFiscalRecord = {
  id: string
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
  lines: LegalArchiveTransactionFiscalLineRecord[]
}

type LegalArchiveTransactionRecord = {
  id: string
  files: unknown
}

type LegalArchiveFileRecord = {
  id: string
  filename: string
  mimetype: string
  metadata: unknown
  createdAt: Date
}

type LegalArchiveFiscalObligationRecord = {
  id: string
  code: string
  periodKey: string
  status: string
  dueDate: Date | null
  owner: string
  requiredEvidence: unknown
}

type LegalArchiveStore = {
  fiscalPeriod: {
    findMany(args: {
      where: { ownerScopeId: string }
      orderBy: [{ fiscalYear: "desc" }, { quarter: "desc" }]
    }): Promise<LegalArchiveFiscalPeriodRecord[]>
    findUnique(args: {
      where: {
        ownerScopeId_periodKey: {
          ownerScopeId: string
          periodKey: string
        }
      }
    }): Promise<LegalArchiveFiscalPeriodRecord | null>
  }
  transactionFiscal: {
    findMany(args: {
      where: { ownerScopeId: string }
      include: {
        lines: {
          orderBy: {
            lineNumber: "asc"
          }
        }
      }
    }): Promise<LegalArchiveTransactionFiscalRecord[]>
  }
  transaction: {
    findMany(args: {
      where: {
        organizationId: string
        id: {
          in: string[]
        }
      }
      select: {
        id: true
        files: true
      }
    }): Promise<LegalArchiveTransactionRecord[]>
  }
  file: {
    findMany(args: {
      where: {
        organizationId: string
        id: {
          in: string[]
        }
      }
      select: {
        id: true
        filename: true
        mimetype: true
        metadata: true
        createdAt: true
      }
    }): Promise<LegalArchiveFileRecord[]>
  }
  fiscalObligation?: {
    findMany(args: {
      where: {
        organizationId: string
        periodKey: string
      }
    }): Promise<LegalArchiveFiscalObligationRecord[]>
  }
  fiscalFilingDossier?: {
    findUnique(args: {
      where: {
        fiscalObligationId: string
      }
    }): Promise<{
      id: string
      fiscalObligationId: string
      draftSnapshot: unknown
      evidenceManifest: unknown
      checklistState: unknown
      filingReference: string | null
      filedAt: Date | null
      filedByUserId: string | null
      filingReceiptFileId: string | null
      filingNotes: string | null
      createdAt: Date
      updatedAt: Date
    } | null>
    upsert(args: {
      where: {
        fiscalObligationId: string
      }
      update: {
        draftSnapshot: unknown
        evidenceManifest: unknown
        checklistState: unknown
        filingReference: string | null
        filedAt: Date | null
        filedByUserId: string | null
        filingReceiptFileId: string | null
        filingNotes: string | null
      }
      create: {
        fiscalObligationId: string
        draftSnapshot: unknown
        evidenceManifest: unknown
        checklistState: unknown
        filingReference: string | null
        filedAt: Date | null
        filedByUserId: string | null
        filingReceiptFileId: string | null
        filingNotes: string | null
      }
    }): Promise<{
      id: string
      fiscalObligationId: string
      draftSnapshot: unknown
      evidenceManifest: unknown
      checklistState: unknown
      filingReference: string | null
      filedAt: Date | null
      filedByUserId: string | null
      filingReceiptFileId: string | null
      filingNotes: string | null
      createdAt: Date
      updatedAt: Date
    }>
  }
}

type LegalArchiveDataset = {
  periods: FiscalPeriod[]
  documents: TransactionFiscalDocument[]
  attachmentsBySourceTransactionId: LegalArchiveAttachmentMap
  referencedAttachmentCountBySourceTransactionId: Record<string, number>
}

const REVIEW_STATUSES: ReviewStatus[] = [
  REVIEW_STATUS_READY,
  REVIEW_STATUS_NEEDS_REVIEW,
  REVIEW_STATUS_BLOCKED,
  REVIEW_STATUS_PENDING,
]

function compareNullableString(left: string | null, right: string | null): number {
  if (left === right) {
    return 0
  }

  if (left === null) {
    return 1
  }

  if (right === null) {
    return -1
  }

  return left.localeCompare(right)
}

function trimToNull(value?: string | null): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function matchesPeriodAssignment(periodKey: string, assignment?: { period_key: string } | null): boolean {
  return assignment?.period_key === periodKey
}

function belongsToFiscalPeriod(period: FiscalPeriod, document: TransactionFiscalDocument): boolean {
  const { header } = document
  const matchesVat = matchesPeriodAssignment(period.periodKey, header.vat_period_assignment)
  const matchesWithholding = matchesPeriodAssignment(period.periodKey, header.withholding_period_assignment)
  return matchesVat || matchesWithholding
}

function compareAttachments(left: LegalArchiveAttachment, right: LegalArchiveAttachment): number {
  return (
    left.filename.localeCompare(right.filename) ||
    left.id.localeCompare(right.id) ||
    compareNullableString(left.createdAt, right.createdAt)
  )
}

function serializeDateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null
}

function serializeDateTime(value: Date): string {
  return value.toISOString()
}

function normalizeFiscalPeriodStatus(status: string): FiscalPeriodStatus {
  switch (status) {
    case FISCAL_PERIOD_STATUS_OPEN:
    case FISCAL_PERIOD_STATUS_IN_REVIEW:
    case FISCAL_PERIOD_STATUS_READY:
    case FISCAL_PERIOD_STATUS_PRESENTED:
    case FISCAL_PERIOD_STATUS_CLOSED:
      return status
    default:
      return FISCAL_PERIOD_STATUS_OPEN
  }
}

function mapFiscalPeriodRecord(record: LegalArchiveFiscalPeriodRecord): FiscalPeriod {
  return {
    id: record.id,
    ownerScopeId: record.ownerScopeId,
    fiscalYear: record.fiscalYear,
    quarter: record.quarter,
    periodKey: record.periodKey,
    startsOn: serializeDateOnly(record.startsOn) ?? "",
    endsOn: serializeDateOnly(record.endsOn) ?? "",
    status: normalizeFiscalPeriodStatus(record.status),
    countryCode: record.countryCode,
    currencyCode: record.currencyCode,
    createdAt: serializeDateTime(record.createdAt),
    updatedAt: serializeDateTime(record.updatedAt),
  }
}

function normalizeReviewReasons(reviewReasons: string[]): string[] {
  return Array.isArray(reviewReasons)
    ? reviewReasons.filter((reason): reason is string => typeof reason === "string")
    : []
}

function normalizeReviewStatus(reviewStatus: string): ReviewStatus {
  return REVIEW_STATUSES.includes(reviewStatus as ReviewStatus)
    ? (reviewStatus as ReviewStatus)
    : REVIEW_STATUS_PENDING
}

function mapLineRecord(line: LegalArchiveTransactionFiscalLineRecord): TransactionFiscalLine {
  return {
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
  }
}

function mapTransactionFiscalRecord(record: LegalArchiveTransactionFiscalRecord): TransactionFiscalDocument {
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
      review_status: normalizeReviewStatus(record.reviewStatus),
      review_reasons: normalizeReviewReasons(record.reviewReasons),
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
    lines: record.lines.map(mapLineRecord),
  }
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function readNestedStringArray(value: unknown, key: string): string[] {
  const record = readRecord(value)
  return record ? readStringArray(record[key]) : []
}

function readAttachmentByteSize(value: unknown): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const metadata = value as Record<string, unknown>
  return typeof metadata.size === "number" ? metadata.size : null
}

function mapFileRecordToAttachment(file: LegalArchiveFileRecord): LegalArchiveAttachmentInput {
  return {
    id: file.id,
    filename: file.filename,
    mediaType: file.mimetype,
    byteSize: readAttachmentByteSize(file.metadata),
    createdAt: file.createdAt.toISOString(),
  }
}

function hasDraftSnapshot(value: unknown): boolean {
  if (!value) {
    return false
  }

  if (Array.isArray(value)) {
    return value.length > 0
  }

  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length > 0
  }

  return true
}

function shouldIncludeSourceForArchiveCandidates(
  period: FiscalPeriod,
  document: TransactionFiscalDocument
): boolean {
  return belongsToFiscalPeriod(period, document)
}

function buildArchiveAttachmentMapForPeriod(
  period: FiscalPeriod,
  documents: TransactionFiscalDocument[],
  attachmentsBySourceTransactionId: LegalArchiveAttachmentMap
): LegalArchiveAttachmentMap {
  const sourceTransactionIds = new Set(
    documents
      .filter((document) => shouldIncludeSourceForArchiveCandidates(period, document))
      .map((document) => document.header.source_transaction_id)
  )

  return Object.fromEntries(
    Object.entries(attachmentsBySourceTransactionId).filter(([sourceTransactionId]) =>
      sourceTransactionIds.has(sourceTransactionId)
    )
  )
}

function buildAttachmentResolutionForPeriod(
  period: FiscalPeriod,
  documents: TransactionFiscalDocument[],
  attachmentsBySourceTransactionId: LegalArchiveAttachmentMap,
  referencedAttachmentCountBySourceTransactionId: Record<string, number>
) {
  const sources = documents
    .filter((document) => shouldIncludeSourceForArchiveCandidates(period, document))
    .map((document) => {
      const sourceTransactionId = document.header.source_transaction_id
      const referencedAttachmentCount =
        referencedAttachmentCountBySourceTransactionId[sourceTransactionId] ?? 0
      const resolvedAttachmentCount =
        attachmentsBySourceTransactionId[sourceTransactionId]?.length ?? 0

      return {
        sourceTransactionId,
        referencedAttachmentCount,
        resolvedAttachmentCount,
        unresolvedAttachmentCount: Math.max(
          0,
          referencedAttachmentCount - resolvedAttachmentCount
        ),
      }
    })
    .sort((left, right) => left.sourceTransactionId.localeCompare(right.sourceTransactionId))

  const attachmentResolution = sources.reduce<LegalArchiveAttachmentResolution>(
    (totals, source) => ({
      referencedAttachmentCount:
        totals.referencedAttachmentCount + source.referencedAttachmentCount,
      resolvedAttachmentCount: totals.resolvedAttachmentCount + source.resolvedAttachmentCount,
      unresolvedAttachmentCount:
        totals.unresolvedAttachmentCount + source.unresolvedAttachmentCount,
    }),
    {
      referencedAttachmentCount: 0,
      resolvedAttachmentCount: 0,
      unresolvedAttachmentCount: 0,
    }
  )

  return {
    attachmentResolution,
    unresolvedSources: sources.filter((source) => source.unresolvedAttachmentCount > 0),
  }
}

async function resolveStore(store?: LegalArchiveStore): Promise<LegalArchiveStore> {
  if (store) {
    return store
  }

  const { prisma } = await import("../../lib/db.ts")
  return prisma as unknown as LegalArchiveStore
}

async function loadLegalArchiveDataset(
  ownerScopeId: string,
  organizationId: string,
  store?: LegalArchiveStore
): Promise<LegalArchiveDataset> {
  const normalizedOwnerScopeId = trimToNull(ownerScopeId)
  const normalizedOrganizationId = trimToNull(organizationId)

  if (!normalizedOwnerScopeId) {
    throw new Error("ownerScopeId es obligatorio para leer el archivo legal fiscal")
  }

  if (!normalizedOrganizationId) {
    throw new Error("organizationId es obligatorio para leer adjuntos del archivo legal fiscal")
  }

  const db = await resolveStore(store)
  const [periodRecords, documentRecords] = await Promise.all([
    db.fiscalPeriod.findMany({
      where: { ownerScopeId: normalizedOwnerScopeId },
      orderBy: [{ fiscalYear: "desc" }, { quarter: "desc" }],
    }),
    db.transactionFiscal.findMany({
      where: { ownerScopeId: normalizedOwnerScopeId },
      include: {
        lines: {
          orderBy: {
            lineNumber: "asc",
          },
        },
      },
    }),
  ])

  const periods = periodRecords.map(mapFiscalPeriodRecord)
  const documents = documentRecords.map(mapTransactionFiscalRecord)
  const sourceTransactionIds = Array.from(
    new Set(documents.map((document) => document.header.source_transaction_id))
  )

  if (sourceTransactionIds.length === 0) {
    return {
      periods,
      documents,
      attachmentsBySourceTransactionId: {},
      referencedAttachmentCountBySourceTransactionId: {},
    }
  }

  const transactions = await db.transaction.findMany({
    where: {
      organizationId: normalizedOrganizationId,
      id: {
        in: sourceTransactionIds,
      },
    },
    select: {
      id: true,
      files: true,
    },
  })

  const referencedAttachmentCountBySourceTransactionId = Object.fromEntries(
    transactions.map((transaction) => [transaction.id, readStringArray(transaction.files).length])
  )
  const fileIds = Array.from(
    new Set(
      transactions.flatMap((transaction) => readStringArray(transaction.files))
    )
  )

  const fileRecords =
    fileIds.length > 0
      ? await db.file.findMany({
          where: {
            organizationId: normalizedOrganizationId,
            id: {
              in: fileIds,
            },
          },
          select: {
            id: true,
            filename: true,
            mimetype: true,
            metadata: true,
            createdAt: true,
          },
        })
      : []

  const fileMap = new Map(fileRecords.map((file) => [file.id, mapFileRecordToAttachment(file)]))
  const attachmentsBySourceTransactionId = Object.fromEntries(
    transactions.map((transaction) => [
      transaction.id,
      readStringArray(transaction.files)
        .map((fileId) => fileMap.get(fileId) ?? null)
        .filter((attachment): attachment is LegalArchiveAttachmentInput => attachment !== null),
    ])
  )

  return {
    periods,
    documents,
    attachmentsBySourceTransactionId,
    referencedAttachmentCountBySourceTransactionId,
  }
}

function compareExpectedSources(left: LegalArchiveExpectedSource, right: LegalArchiveExpectedSource): number {
  return (
    compareNullableString(left.issueDate, right.issueDate) ||
    left.sourceTransactionId.localeCompare(right.sourceTransactionId) ||
    left.fiscalDocumentId.localeCompare(right.fiscalDocumentId)
  )
}

function sortAndNormalizeAttachments(attachments: LegalArchiveAttachmentInput[] | undefined): LegalArchiveAttachment[] {
  return (attachments ?? [])
    .map((attachment) => ({
      id: attachment.id,
      filename: attachment.filename,
      mediaType: attachment.mediaType ?? null,
      byteSize: attachment.byteSize ?? null,
      createdAt: attachment.createdAt ?? null,
    }))
    .sort(compareAttachments)
}

function buildManifestPeriod(period: FiscalPeriod): LegalArchiveManifestPeriod {
  return {
    fiscalYear: period.fiscalYear,
    quarter: period.quarter,
    periodKey: period.periodKey,
    startsOn: period.startsOn,
    endsOn: period.endsOn,
    status: period.status,
  }
}

function buildExpectedSource(
  period: FiscalPeriod,
  document: TransactionFiscalDocument,
  attachments: LegalArchiveAttachment[]
): LegalArchiveExpectedSource {
  const includesVat = matchesPeriodAssignment(period.periodKey, document.header.vat_period_assignment)
  const includesWithholding = matchesPeriodAssignment(
    period.periodKey,
    document.header.withholding_period_assignment
  )

  return {
    sourceTransactionId: document.header.source_transaction_id,
    fiscalDocumentId: document.header.fiscal_document_id,
    documentKind: document.header.document_kind,
    issueDate: document.header.issue_date,
    reviewStatus: normalizeReviewStatus(document.header.review_status),
    reviewReasons: [...document.header.review_reasons],
    includesVat,
    includesWithholding,
    expectedAttachmentCount: 1,
    availableAttachmentCount: attachments.length,
    attachmentStatus:
      attachments.length > 0
        ? LEGAL_ARCHIVE_ATTACHMENT_STATUS.AVAILABLE
        : LEGAL_ARCHIVE_ATTACHMENT_STATUS.MISSING,
    attachments,
  }
}

function buildUnexpectedSources(
  expectedSourceTransactionIds: Set<string>,
  attachmentsBySourceTransactionId: LegalArchiveAttachmentMap
): LegalArchiveUnexpectedSource[] {
  return Object.entries(attachmentsBySourceTransactionId)
    .filter(([sourceTransactionId, attachments]) => {
      return !expectedSourceTransactionIds.has(sourceTransactionId) && attachments.length > 0
    })
    .map(([sourceTransactionId, attachments]) => {
      const normalizedAttachments = sortAndNormalizeAttachments(attachments)

      return {
        sourceTransactionId,
        attachmentCount: normalizedAttachments.length,
        attachments: normalizedAttachments,
      }
    })
    .sort((left, right) => left.sourceTransactionId.localeCompare(right.sourceTransactionId))
}

function buildManifestTotals(
  sources: LegalArchiveExpectedSource[],
  unexpectedSources: LegalArchiveUnexpectedSource[]
): LegalArchiveManifestTotals {
  const expectedSourceCount = sources.length
  const availableSourceCount = sources.filter((source) => source.availableAttachmentCount > 0).length
  const missingSourceCount = expectedSourceCount - availableSourceCount
  const attachmentCount = sources.reduce((total, source) => total + source.availableAttachmentCount, 0)
  const unexpectedSourceCount = unexpectedSources.length
  const unexpectedAttachmentCount = unexpectedSources.reduce(
    (total, source) => total + source.attachmentCount,
    0
  )

  return {
    expectedSourceCount,
    availableSourceCount,
    missingSourceCount,
    attachmentCount,
    unexpectedSourceCount,
    unexpectedAttachmentCount,
  }
}

function compareLegalArchiveFilings(left: LegalArchiveFiling, right: LegalArchiveFiling): number {
  return left.code.localeCompare(right.code) || left.obligationId.localeCompare(right.obligationId)
}

async function buildLegalArchiveFilings(
  organizationId: string,
  period: FiscalPeriod,
  store: LegalArchiveStore
): Promise<LegalArchiveFiling[]> {
  if (!store.fiscalObligation || !store.fiscalFilingDossier) {
    return []
  }

  const obligationRecords = await store.fiscalObligation.findMany({
    where: {
      organizationId,
      periodKey: period.periodKey,
    },
  })

  if (obligationRecords.length === 0) {
    return []
  }

  const dossierEntries = await Promise.all(
    obligationRecords.map(async (obligation) => [
      obligation.id,
      await getFiscalFilingDossierByObligationId(obligation.id, {
        fiscalFilingDossier: store.fiscalFilingDossier!,
      }),
    ] as const)
  )

  const dossierByObligationId = new Map<string, FiscalFilingDossier | null>(dossierEntries)
  const receiptFileIds = Array.from(
    new Set(
      dossierEntries
        .map(([, dossier]) => dossier?.filingReceiptFileId ?? null)
        .filter((fileId): fileId is string => Boolean(fileId))
    )
  )
  const receiptFiles =
    receiptFileIds.length > 0
      ? await store.file.findMany({
          where: {
            organizationId,
            id: {
              in: receiptFileIds,
            },
          },
          select: {
            id: true,
            filename: true,
            mimetype: true,
            metadata: true,
            createdAt: true,
          },
        })
      : []
  const receiptAttachmentById = new Map(
    receiptFiles.map((file) => {
      const attachment = sortAndNormalizeAttachments([mapFileRecordToAttachment(file)])[0] ?? null
      return [file.id, attachment]
    })
  )

  return obligationRecords
    .map((obligation) => {
      const dossier = dossierByObligationId.get(obligation.id) ?? null
      const receipt =
        dossier?.filingReceiptFileId
          ? (receiptAttachmentById.get(dossier.filingReceiptFileId) ?? null)
          : null
      const requiredEvidence = Array.from(
        new Set([
          ...readStringArray(obligation.requiredEvidence),
          ...readNestedStringArray(dossier?.evidenceManifest, "required"),
        ])
      ).sort()
      const attachedEvidence = Array.from(
        new Set([
          ...readNestedStringArray(dossier?.evidenceManifest, "attached"),
          ...(receipt ? ["filing_receipt"] : []),
        ])
      ).sort()
      const missingEvidence = requiredEvidence.filter(
        (evidenceCode) => !attachedEvidence.includes(evidenceCode)
      )

      return {
        obligationId: obligation.id,
        code: obligation.code,
        periodKey: obligation.periodKey,
        status: obligation.status,
        dueDate: serializeDateOnly(obligation.dueDate),
        owner: obligation.owner,
        hasDraftSnapshot: hasDraftSnapshot(dossier?.draftSnapshot),
        draftSnapshot: dossier?.draftSnapshot ?? {},
        filingReference: dossier?.filingReference ?? null,
        filedAt: dossier?.filedAt ?? null,
        filingNotes: dossier?.filingNotes ?? null,
        requiredEvidence,
        attachedEvidence,
        missingEvidence,
        filingReceipt: receipt,
      } satisfies LegalArchiveFiling
    })
    .sort(compareLegalArchiveFilings)
}

export function buildLegalArchiveManifest(
  period: FiscalPeriod,
  documents: TransactionFiscalDocument[],
  attachmentsBySourceTransactionId: LegalArchiveAttachmentMap = {},
  filings: LegalArchiveFiling[] = []
): LegalArchiveManifest {
  const sources = documents
    .filter((document) => belongsToFiscalPeriod(period, document))
    .map((document) => {
      const attachments = sortAndNormalizeAttachments(
        attachmentsBySourceTransactionId[document.header.source_transaction_id]
      )

      return buildExpectedSource(period, document, attachments)
    })
    .sort(compareExpectedSources)

  const expectedSourceTransactionIds = new Set(
    sources.map((source) => source.sourceTransactionId)
  )
  const unexpectedSources = buildUnexpectedSources(
    expectedSourceTransactionIds,
    attachmentsBySourceTransactionId
  )

  return {
    manifestVersion: LEGAL_ARCHIVE_MANIFEST_VERSION,
    period: buildManifestPeriod(period),
    totals: buildManifestTotals(sources, unexpectedSources),
    sources,
    unexpectedSources,
    filings,
  }
}

export async function listLegalArchivePeriods(
  ownerScopeId: string,
  organizationId: string,
  store?: LegalArchiveStore
): Promise<LegalArchivePeriodListItem[]> {
  return withFiscalStorageGuard(async () => {
    const dataset = await loadLegalArchiveDataset(ownerScopeId, organizationId, store)

    return dataset.periods.map((period) => {
      const periodAttachmentMap = buildArchiveAttachmentMapForPeriod(
        period,
        dataset.documents,
        dataset.attachmentsBySourceTransactionId
      )
      const { attachmentResolution } = buildAttachmentResolutionForPeriod(
        period,
        dataset.documents,
        periodAttachmentMap,
        dataset.referencedAttachmentCountBySourceTransactionId
      )

      return {
        period,
        manifest: buildLegalArchiveManifest(period, dataset.documents, periodAttachmentMap),
        attachmentResolution,
      }
    })
  })
}

export async function getLegalArchivePeriodDetail(
  ownerScopeId: string,
  organizationId: string,
  periodKey: string,
  store?: LegalArchiveStore
): Promise<LegalArchivePeriodDetail | null> {
  return withFiscalStorageGuard(async () => {
    const dataset = await loadLegalArchiveDataset(ownerScopeId, organizationId, store)
    const db = await resolveStore(store)
    const period = dataset.periods.find((candidate) => candidate.periodKey === periodKey)

    if (!period) {
      return null
    }

    const periodAttachmentMap = buildArchiveAttachmentMapForPeriod(
      period,
      dataset.documents,
      dataset.attachmentsBySourceTransactionId
    )
    const { attachmentResolution, unresolvedSources } = buildAttachmentResolutionForPeriod(
      period,
      dataset.documents,
      periodAttachmentMap,
      dataset.referencedAttachmentCountBySourceTransactionId
    )
    const filings = await buildLegalArchiveFilings(organizationId, period, db)

    return {
      period,
      manifest: buildLegalArchiveManifest(period, dataset.documents, periodAttachmentMap, filings),
      attachmentResolution,
      unresolvedSources,
    }
  })
}
