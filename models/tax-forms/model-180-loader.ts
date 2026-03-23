import { getFiscalProfileAccessByOrganizationId } from "../fiscal/profile.ts"
import { listQuarterlyDrafts, type QuarterlyDraft } from "../fiscal/quarterly-draft.ts"
import { listTransactionFiscalDocuments } from "../fiscal/transaction-fiscal.ts"
import { buildModel180Draft, type Model180Draft } from "./model-180.ts"

type Model180LoaderStatus = "ready" | "profile_missing" | "storage_not_ready"

type Model180LoaderDependencies = {
  getFiscalProfileAccessByOrganizationId?: typeof getFiscalProfileAccessByOrganizationId
  listQuarterlyDrafts?: typeof listQuarterlyDrafts
  listTransactionFiscalDocuments?: typeof listTransactionFiscalDocuments
}

type Model180LoaderPeriod = {
  fiscalYear: number
  periodKey: string
  selectionSource: "requested" | "active"
}

type Model180LoaderProfile = {
  id: string
  companyName: string
  taxId: string
}

export type Model180DraftLoaderResult =
  | {
      status: "ready"
      profile: Model180LoaderProfile
      period: Model180LoaderPeriod
      availablePeriodKeys: string[]
      draft: Model180Draft
      readiness: Model180Draft["readiness"]
    }
  | {
      status: Exclude<Model180LoaderStatus, "ready">
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
    throw new Error("periodKey es obligatorio para cargar el modelo 180")
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
): Model180LoaderPeriod {
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

export async function loadModel180DraftForTenant(
  input: {
    organizationId: string
    userId: string
    periodKey?: string
  },
  dependencies: Model180LoaderDependencies = {}
): Promise<Model180DraftLoaderResult> {
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
  const draft = buildModel180Draft({
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
    readiness: draft.readiness,
  }
}
