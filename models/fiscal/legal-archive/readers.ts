import { withFiscalStorageGuard } from "../storage.ts"
import { buildLegalArchiveFilings } from "./filings.ts"
import {
  buildArchiveAttachmentMapForPeriod,
  buildAttachmentResolutionForPeriod,
  loadLegalArchiveDataset,
  resolveLegalArchiveStore,
} from "./dataset.ts"
import { buildLegalArchiveManifest } from "./manifest.ts"
import type {
  LegalArchivePeriodDetail,
  LegalArchivePeriodListItem,
  LegalArchiveStore,
} from "./types.ts"

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
    const db = await resolveLegalArchiveStore(store)
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
