import { getFiscalProfileAccessByOrganizationId } from "../fiscal/profile.ts"
import { listQuarterlyDrafts, type QuarterlyDraft } from "../fiscal/quarterly-draft.ts"
import { listTransactionFiscalDocuments } from "../fiscal/transaction-fiscal.ts"
import { buildModel390Draft, type Model390Draft } from "./model-390.ts"

type Model390LoaderStatus = "ready" | "profile_missing" | "storage_not_ready"

export type Model390ReadinessSummary = {
  candidate_document_count: number
  included_document_count: number
  ready_document_count: number
  blocked_document_count: number
  needs_review_document_count: number
  pending_document_count: number
}

type Model390LoaderDependencies = {
  getFiscalProfileAccessByOrganizationId?: typeof getFiscalProfileAccessByOrganizationId
  listQuarterlyDrafts?: typeof listQuarterlyDrafts
  listTransactionFiscalDocuments?: typeof listTransactionFiscalDocuments
}

type Model390LoaderPeriod = {
  fiscalYear: number
  periodKey: string
  selectionSource: "requested" | "active"
}

type Model390LoaderProfile = {
  id: string
  companyName: string
  taxId: string
}

export type Model390DraftLoaderResult =
  | {
      status: "ready"
      profile: Model390LoaderProfile
      period: Model390LoaderPeriod
      availablePeriodKeys: string[]
      draft: Model390Draft
      readiness: Model390ReadinessSummary
    }
  | {
      status: Exclude<Model390LoaderStatus, "ready">
      availablePeriodKeys: string[]
    }

function trimToNull(value?: string | null) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function isActiveQuarterCandidate(draft: QuarterlyDraft) {
  return draft.operationalStatus.code !== "closed" && draft.operationalStatus.code !== "presented"
}

function pickActiveQuarter(drafts: QuarterlyDraft[]) {
  return drafts.find(isActiveQuarterCandidate) ?? drafts[0] ?? null
}

function parseAnnualPeriodKey(periodKey: string) {
  const normalized = trimToNull(periodKey)

  if (!normalized) {
    throw new Error("periodKey es obligatorio para cargar el modelo 390")
  }

  const match = /^(\d{4})-Y$/.exec(normalized)
  if (!match) {
    throw new Error("periodKey debe seguir el formato YYYY-Y")
  }

  return {
    fiscalYear: Number.parseInt(match[1] ?? "", 10),
    periodKey: normalized,
  }
}

function resolveFallbackYear(now: Date) {
  const fiscalYear = now.getUTCFullYear()
  return {
    fiscalYear,
    periodKey: `${fiscalYear}-Y`,
  }
}

function resolveSelectedPeriod(
  requestedPeriodKey: string | undefined,
  drafts: QuarterlyDraft[],
  now: Date
): Model390LoaderPeriod {
  const normalizedRequestedPeriodKey = trimToNull(requestedPeriodKey)

  if (normalizedRequestedPeriodKey) {
    return {
      ...parseAnnualPeriodKey(normalizedRequestedPeriodKey),
      selectionSource: "requested",
    }
  }

  const activeQuarter = pickActiveQuarter(drafts)
  if (activeQuarter) {
    return {
      fiscalYear: activeQuarter.period.fiscalYear,
      periodKey: `${activeQuarter.period.fiscalYear}-Y`,
      selectionSource: "active",
    }
  }

  return {
    ...resolveFallbackYear(now),
    selectionSource: "active",
  }
}

function listAnnualPeriodKeys(drafts: QuarterlyDraft[]) {
  return [...new Set(drafts.map((draft) => `${draft.period.fiscalYear}-Y`))].sort((left, right) =>
    right.localeCompare(left)
  )
}

function buildReadinessSummary(
  fiscalYear: number,
  documents: Awaited<ReturnType<typeof listTransactionFiscalDocuments>>,
  draft: Model390Draft
): Model390ReadinessSummary {
  const candidateDocumentIds = new Set<string>()
  const blockedDocumentIds = new Set<string>()
  const needsReviewDocumentIds = new Set<string>()
  const pendingDocumentIds = new Set<string>()
  const readyDocumentIds = new Set<string>(draft.documents_included)

  for (const document of documents) {
    const vatPeriodAssignment = document.header.vat_period_assignment

    if (!vatPeriodAssignment || vatPeriodAssignment.fiscal_year !== fiscalYear) {
      continue
    }

    candidateDocumentIds.add(document.header.fiscal_document_id)

    if (document.header.review_status === "blocked") {
      blockedDocumentIds.add(document.header.fiscal_document_id)
    } else if (document.header.review_status === "needs_review") {
      needsReviewDocumentIds.add(document.header.fiscal_document_id)
    } else if (document.header.review_status === "pending") {
      pendingDocumentIds.add(document.header.fiscal_document_id)
    }
  }

  return {
    candidate_document_count: candidateDocumentIds.size,
    included_document_count: draft.documents_included.length,
    ready_document_count: readyDocumentIds.size,
    blocked_document_count: blockedDocumentIds.size,
    needs_review_document_count: needsReviewDocumentIds.size,
    pending_document_count: pendingDocumentIds.size,
  }
}

export async function loadModel390DraftForTenant(
  input: {
    organizationId: string
    userId: string
    periodKey?: string
  },
  dependencies: Model390LoaderDependencies = {}
): Promise<Model390DraftLoaderResult> {
  const loadFiscalProfileAccess =
    dependencies.getFiscalProfileAccessByOrganizationId ?? getFiscalProfileAccessByOrganizationId
  const fiscalProfileAccess = await loadFiscalProfileAccess(input.organizationId, input.userId)

  if (fiscalProfileAccess.status !== "ready") {
    return {
      status: fiscalProfileAccess.status,
      availablePeriodKeys: [],
    }
  }

  const loadQuarterlyDrafts = dependencies.listQuarterlyDrafts ?? listQuarterlyDrafts
  const drafts = await loadQuarterlyDrafts(fiscalProfileAccess.profile.id)
  const selectedPeriod = resolveSelectedPeriod(input.periodKey, drafts, new Date())
  const loadDocuments =
    dependencies.listTransactionFiscalDocuments ?? listTransactionFiscalDocuments
  const documents = await loadDocuments(fiscalProfileAccess.profile.id)
  const draft = buildModel390Draft({
    documents,
    fiscalYear: selectedPeriod.fiscalYear,
  })

  return {
    status: "ready",
    profile: {
      id: fiscalProfileAccess.profile.id,
      companyName: fiscalProfileAccess.profile.companyName,
      taxId: fiscalProfileAccess.profile.taxId,
    },
    period: selectedPeriod,
    availablePeriodKeys: input.periodKey ? [selectedPeriod.periodKey] : listAnnualPeriodKeys(drafts),
    draft,
    readiness: buildReadinessSummary(selectedPeriod.fiscalYear, documents, draft),
  }
}
