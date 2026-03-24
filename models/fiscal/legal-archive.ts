// Stable public facade for archive manifests and archive readers. Keep imports pinned to
// models/fiscal/legal-archive while attachments, filings and manifest builders split internally.

export {
  LEGAL_ARCHIVE_ATTACHMENT_STATUS,
  LEGAL_ARCHIVE_MANIFEST_VERSION,
  type LegalArchiveAttachment,
  type LegalArchiveAttachmentInput,
  type LegalArchiveAttachmentMap,
  type LegalArchiveAttachmentResolution,
  type LegalArchiveAttachmentStatus,
  type LegalArchiveExpectedSource,
  type LegalArchiveFiling,
  type LegalArchiveManifest,
  type LegalArchiveManifestPeriod,
  type LegalArchiveManifestTotals,
  type LegalArchivePeriodDetail,
  type LegalArchivePeriodListItem,
  type LegalArchiveUnexpectedSource,
  type LegalArchiveUnresolvedSource,
} from "./legal-archive/types.ts"

export { buildLegalArchiveManifest } from "./legal-archive/manifest.ts"
export { getLegalArchivePeriodDetail, listLegalArchivePeriods } from "./legal-archive/readers.ts"
