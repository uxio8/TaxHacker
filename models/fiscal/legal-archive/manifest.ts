import type { FiscalPeriod } from "../periods.ts"
import type { TransactionFiscalDocument } from "../transaction-fiscal.ts"
import {
  LEGAL_ARCHIVE_ATTACHMENT_STATUS,
  LEGAL_ARCHIVE_MANIFEST_VERSION,
  type LegalArchiveAttachmentMap,
  type LegalArchiveExpectedSource,
  type LegalArchiveFiling,
  type LegalArchiveManifest,
  type LegalArchiveManifestPeriod,
  type LegalArchiveManifestTotals,
  type LegalArchiveUnexpectedSource,
} from "./types.ts"
import {
  belongsToFiscalPeriod,
  compareNullableString,
  matchesPeriodAssignment,
  normalizeReviewStatus,
  sortAndNormalizeAttachments,
} from "./shared.ts"

function compareExpectedSources(left: LegalArchiveExpectedSource, right: LegalArchiveExpectedSource): number {
  return (
    compareNullableString(left.issueDate, right.issueDate) ||
    left.sourceTransactionId.localeCompare(right.sourceTransactionId) ||
    left.fiscalDocumentId.localeCompare(right.fiscalDocumentId)
  )
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
  attachments: ReturnType<typeof sortAndNormalizeAttachments>
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

  const expectedSourceTransactionIds = new Set(sources.map((source) => source.sourceTransactionId))
  const unexpectedSources = buildUnexpectedSources(expectedSourceTransactionIds, attachmentsBySourceTransactionId)

  return {
    manifestVersion: LEGAL_ARCHIVE_MANIFEST_VERSION,
    period: buildManifestPeriod(period),
    totals: buildManifestTotals(sources, unexpectedSources),
    sources,
    unexpectedSources,
    filings,
  }
}
