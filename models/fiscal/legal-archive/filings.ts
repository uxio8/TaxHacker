import { getFiscalFilingDossierByObligationId, type FiscalFilingDossier } from "../filing-dossiers.ts"
import type { FiscalPeriod } from "../periods.ts"
import {
  type LegalArchiveFiling,
  type LegalArchiveStore,
} from "./types.ts"
import {
  hasDraftSnapshot,
  mapFileRecordToAttachment,
  readNestedStringArray,
  readStringArray,
  serializeDateOnly,
  sortAndNormalizeAttachments,
} from "./shared.ts"

function compareLegalArchiveFilings(left: LegalArchiveFiling, right: LegalArchiveFiling): number {
  return left.code.localeCompare(right.code) || left.obligationId.localeCompare(right.obligationId)
}

export async function buildLegalArchiveFilings(
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
