import { getFiscalProfileAccessByOrganizationId } from "../fiscal/profile.ts"
import { listQuarterlyDrafts, type QuarterlyDraft } from "../fiscal/quarterly-draft.ts"

type Model111ManualLoaderStatus = "ready" | "profile_missing" | "storage_not_ready"
type Model111ManualRequiredEvidenceCode = "external_payroll_summary" | "filing_receipt"

type Model111ManualLoaderDependencies = {
  getFiscalProfileAccessByOrganizationId?: typeof getFiscalProfileAccessByOrganizationId
  listQuarterlyDrafts?: typeof listQuarterlyDrafts
  now?: Date
}

type Model111ManualPeriodSelectionSource = "requested" | "active"

type Model111ManualPeriod = {
  fiscalYear: number
  quarter: number
  periodKey: string
  selectionSource: Model111ManualPeriodSelectionSource
}

type Model111ManualProfile = {
  id: string
  companyName: string
  taxId: string
  hasEmployees: boolean
  hasProfessionalWithholding: boolean
}

export type Model111ManualDraft = {
  mode: "manual_quarterly_summary"
  applies: boolean
  readinessLabel: string
  automation: {
    isAutomated: false
    label: string
    detail: string
  }
  evidence: {
    externalEvidenceRequired: true
    requiredEvidenceCodes: Model111ManualRequiredEvidenceCode[]
    detail: string
  }
  checklist: string[]
  warnings: string[]
}

export type Model111ManualLoaderResult =
  | {
      status: "ready"
      profile: Model111ManualProfile
      period: Model111ManualPeriod
      availablePeriodKeys: string[]
      manual: Model111ManualDraft
    }
  | {
      status: "profile_missing" | "storage_not_ready"
      availablePeriodKeys: string[]
    }

const MODEL_111_REQUIRED_EVIDENCE_CODES: Model111ManualRequiredEvidenceCode[] = [
  "external_payroll_summary",
  "filing_receipt",
]

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

function parsePeriodKey(periodKey: string): Omit<Model111ManualPeriod, "selectionSource"> {
  const normalized = trimToNull(periodKey)

  if (!normalized) {
    throw new Error("periodKey es obligatorio para cargar el Modelo 111 manual")
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

function resolveFallbackCurrentQuarter(now: Date): Omit<Model111ManualPeriod, "selectionSource"> {
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
): Model111ManualPeriod {
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

function buildManualDraft(applies: boolean): Model111ManualDraft {
  return {
    mode: "manual_quarterly_summary",
    applies,
    readinessLabel: applies ? "Pendiente de evidencia externa" : "No aplica según el perfil fiscal",
    automation: {
      isAutomated: false,
      label: "No automatizado por TaxHacker",
      detail:
        "TaxHacker no calcula el Modelo 111 desde transacciones ni desde nómina interna. Este espacio solo sirve como resumen trimestral manual y control operativo.",
    },
    evidence: {
      externalEvidenceRequired: true,
      requiredEvidenceCodes: [...MODEL_111_REQUIRED_EVIDENCE_CODES],
      detail:
        "Hace falta evidencia externa para sostener el trimestre: resumen de nómina o asesoría y justificante final de presentación.",
    },
    checklist: [
      "Preparar el resumen trimestral desde la fuente externa de nómina o desde la asesoría.",
      "Validar los importes fuera de TaxHacker antes de revisar el trimestre.",
      "Conservar el soporte externo y el justificante final como evidencia obligatoria.",
    ],
    warnings: [
      "No se calcula ninguna retención dentro de TaxHacker para el Modelo 111.",
      "No uses payroll_placeholder ni movimientos bancarios como si fueran fuente automática del 111.",
      "Este resumen manual no desbloquea el Modelo 190.",
    ],
  }
}

export async function loadModel111ManualForTenant(
  input: {
    organizationId: string
    userId: string
    periodKey?: string
  },
  dependencies: Model111ManualLoaderDependencies = {}
): Promise<Model111ManualLoaderResult> {
  const loadFiscalProfileAccess =
    dependencies.getFiscalProfileAccessByOrganizationId ?? getFiscalProfileAccessByOrganizationId
  const fiscalProfileAccess = await loadFiscalProfileAccess(input.organizationId, input.userId)

  if (fiscalProfileAccess.status !== "ready") {
    return {
      status: fiscalProfileAccess.status as Exclude<Model111ManualLoaderStatus, "ready">,
      availablePeriodKeys: [],
    }
  }

  const loadQuarterlyDrafts = dependencies.listQuarterlyDrafts ?? listQuarterlyDrafts
  const drafts = await loadQuarterlyDrafts(fiscalProfileAccess.profile.id)
  const selectedPeriod = resolveSelectedPeriod(input.periodKey, drafts, dependencies.now ?? new Date())
  const applies =
    fiscalProfileAccess.profile.hasEmployees || fiscalProfileAccess.profile.hasProfessionalWithholding

  return {
    status: "ready",
    profile: {
      id: fiscalProfileAccess.profile.id,
      companyName: fiscalProfileAccess.profile.companyName,
      taxId: fiscalProfileAccess.profile.taxId,
      hasEmployees: fiscalProfileAccess.profile.hasEmployees,
      hasProfessionalWithholding: fiscalProfileAccess.profile.hasProfessionalWithholding,
    },
    period: selectedPeriod,
    availablePeriodKeys: drafts.map((candidate) => candidate.period.periodKey),
    manual: buildManualDraft(applies),
  }
}
