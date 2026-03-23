import { getFiscalProfileAccessByOrganizationId } from "../fiscal/profile.ts"
import { listQuarterlyDrafts, type QuarterlyDraft } from "../fiscal/quarterly-draft.ts"
import { listTransactionFiscalDocuments } from "../fiscal/transaction-fiscal.ts"
import { buildModel115Draft, type Model115Draft } from "./model-115.ts"

type Model115LoaderStatus = "ready" | "profile_missing" | "storage_not_ready"

type Model115LoaderDependencies = {
  getFiscalProfileAccessByOrganizationId?: typeof getFiscalProfileAccessByOrganizationId
  listQuarterlyDrafts?: typeof listQuarterlyDrafts
  listTransactionFiscalDocuments?: typeof listTransactionFiscalDocuments
}

type Model115LoaderPeriodSelectionSource = "requested" | "active"

type Model115LoaderPeriod = {
  fiscalYear: number
  quarter: number
  periodKey: string
  selectionSource: Model115LoaderPeriodSelectionSource
}

type Model115LoaderProfile = {
  id: string
  companyName: string
  taxId: string
}

export type Model115DraftLoaderResult =
  | {
      status: "ready"
      profile: Model115LoaderProfile
      period: Model115LoaderPeriod
      availablePeriodKeys: string[]
      draft: Model115Draft
      readiness: Model115Draft["readiness"]
    }
  | {
      status: "profile_missing" | "storage_not_ready"
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

function parsePeriodKey(periodKey: string): Omit<Model115LoaderPeriod, "selectionSource"> {
  const normalized = trimToNull(periodKey)

  if (!normalized) {
    throw new Error("periodKey es obligatorio para cargar el borrador 115")
  }

  const match = /^(\d{4})-Q([1-4])$/.exec(normalized)
  if (!match) {
    throw new Error("periodKey debe seguir el formato YYYY-QN")
  }

  return {
    fiscalYear: Number.parseInt(match[1] ?? "", 10),
    quarter: Number.parseInt(match[2] ?? "", 10),
    periodKey: normalized,
  }
}

function resolveFallbackCurrentQuarter(now: Date): Omit<Model115LoaderPeriod, "selectionSource"> {
  const fiscalYear = now.getUTCFullYear()
  const quarter = Math.floor(now.getUTCMonth() / 3) + 1
  return {
    fiscalYear,
    quarter,
    periodKey: `${fiscalYear}-Q${quarter}`,
  }
}

function resolveSelectedPeriod(
  requestedPeriodKey: string | undefined,
  drafts: QuarterlyDraft[],
  now: Date
): Model115LoaderPeriod {
  const normalizedRequestedPeriodKey = trimToNull(requestedPeriodKey)

  if (normalizedRequestedPeriodKey) {
    return {
      ...parsePeriodKey(normalizedRequestedPeriodKey),
      selectionSource: "requested",
    }
  }

  const activeQuarter = pickActiveQuarter(drafts)
  if (activeQuarter) {
    return {
      fiscalYear: activeQuarter.period.fiscalYear,
      quarter: activeQuarter.period.quarter,
      periodKey: activeQuarter.period.periodKey,
      selectionSource: "active",
    }
  }

  return {
    ...resolveFallbackCurrentQuarter(now),
    selectionSource: "active",
  }
}

export async function loadModel115DraftForTenant(
  input: {
    organizationId: string
    userId: string
    periodKey?: string
  },
  dependencies: Model115LoaderDependencies = {}
): Promise<Model115DraftLoaderResult> {
  const loadFiscalProfileAccess =
    dependencies.getFiscalProfileAccessByOrganizationId ?? getFiscalProfileAccessByOrganizationId
  const fiscalProfileAccess = await loadFiscalProfileAccess(input.organizationId, input.userId)

  if (fiscalProfileAccess.status !== "ready") {
    return {
      status: fiscalProfileAccess.status as Exclude<Model115LoaderStatus, "ready">,
      availablePeriodKeys: [],
    }
  }

  const loadQuarterlyDrafts = dependencies.listQuarterlyDrafts ?? listQuarterlyDrafts
  const drafts = await loadQuarterlyDrafts(fiscalProfileAccess.profile.id)
  const selectedPeriod = resolveSelectedPeriod(input.periodKey, drafts, new Date())
  const loadTransactionFiscalDocuments =
    dependencies.listTransactionFiscalDocuments ?? listTransactionFiscalDocuments
  const documents = await loadTransactionFiscalDocuments(fiscalProfileAccess.profile.id)
  const draft = buildModel115Draft({
    documents,
    fiscalYear: selectedPeriod.fiscalYear,
    quarter: selectedPeriod.quarter,
  })

  return {
    status: "ready",
    profile: {
      id: fiscalProfileAccess.profile.id,
      companyName: fiscalProfileAccess.profile.companyName,
      taxId: fiscalProfileAccess.profile.taxId,
    },
    period: selectedPeriod,
    availablePeriodKeys: drafts.map((candidate) => candidate.period.periodKey),
    draft,
    readiness: draft.readiness,
  }
}
