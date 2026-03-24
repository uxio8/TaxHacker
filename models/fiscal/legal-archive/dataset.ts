import type { FiscalPeriod } from "../periods.ts"
import type { TransactionFiscalDocument } from "../transaction-fiscal.ts"
import {
  belongsToFiscalPeriod,
  mapFileRecordToAttachment,
  mapFiscalPeriodRecord,
  mapTransactionFiscalRecord,
  readStringArray,
  trimToNull,
} from "./shared.ts"
import type {
  LegalArchiveAttachmentMap,
  LegalArchiveAttachmentResolution,
  LegalArchiveDataset,
  LegalArchiveStore,
  LegalArchiveUnresolvedSource,
} from "./types.ts"

export async function resolveLegalArchiveStore(store?: LegalArchiveStore): Promise<LegalArchiveStore> {
  if (store) {
    return store
  }

  const { prisma } = await import("../../../lib/db.ts")
  return prisma as unknown as LegalArchiveStore
}

export async function loadLegalArchiveDataset(
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

  const db = await resolveLegalArchiveStore(store)
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
  const fileIds = Array.from(new Set(transactions.flatMap((transaction) => readStringArray(transaction.files))))

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
        .filter((attachment) => attachment !== null),
    ])
  ) as LegalArchiveAttachmentMap

  return {
    periods,
    documents,
    attachmentsBySourceTransactionId,
    referencedAttachmentCountBySourceTransactionId,
  }
}

function shouldIncludeSourceForArchiveCandidates(
  period: FiscalPeriod,
  document: TransactionFiscalDocument
): boolean {
  return belongsToFiscalPeriod(period, document)
}

export function buildArchiveAttachmentMapForPeriod(
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

export function buildAttachmentResolutionForPeriod(
  period: FiscalPeriod,
  documents: TransactionFiscalDocument[],
  attachmentsBySourceTransactionId: LegalArchiveAttachmentMap,
  referencedAttachmentCountBySourceTransactionId: Record<string, number>
): {
  attachmentResolution: LegalArchiveAttachmentResolution
  unresolvedSources: LegalArchiveUnresolvedSource[]
} {
  const sources = documents
    .filter((document) => shouldIncludeSourceForArchiveCandidates(period, document))
    .map((document) => {
      const sourceTransactionId = document.header.source_transaction_id
      const referencedAttachmentCount =
        referencedAttachmentCountBySourceTransactionId[sourceTransactionId] ?? 0
      const resolvedAttachmentCount = attachmentsBySourceTransactionId[sourceTransactionId]?.length ?? 0

      return {
        sourceTransactionId,
        referencedAttachmentCount,
        resolvedAttachmentCount,
        unresolvedAttachmentCount: Math.max(0, referencedAttachmentCount - resolvedAttachmentCount),
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
