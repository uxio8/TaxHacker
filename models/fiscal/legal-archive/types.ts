import type {
  FiscalPeriod,
  FiscalPeriodStatus,
} from "../periods.ts"
import type {
  FiscalPeriodAssignment,
  ReviewStatus,
} from "../review-status.ts"
import type { TransactionFiscalDocument } from "../transaction-fiscal.ts"

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

export type LegalArchiveFiscalPeriodRecord = {
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

export type LegalArchiveTransactionFiscalLineRecord = {
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

export type LegalArchiveTransactionFiscalRecord = {
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

export type LegalArchiveTransactionRecord = {
  id: string
  files: unknown
}

export type LegalArchiveFileRecord = {
  id: string
  filename: string
  mimetype: string
  metadata: unknown
  createdAt: Date
}

export type LegalArchiveFiscalObligationRecord = {
  id: string
  code: string
  periodKey: string
  status: string
  dueDate: Date | null
  owner: string
  requiredEvidence: unknown
}

export type LegalArchiveStore = {
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

export type LegalArchiveDataset = {
  periods: FiscalPeriod[]
  documents: TransactionFiscalDocument[]
  attachmentsBySourceTransactionId: LegalArchiveAttachmentMap
  referencedAttachmentCountBySourceTransactionId: Record<string, number>
}
