import { canAnalyzeFileMimeType, getAnalyzeMimeTypeError } from "../lib/analysis-support.ts"
import { getMobileConfidence, readMobileTriageMetadata } from "../lib/mobile-triage.ts"

export const UNSORTED_INBOX_STATE = {
  PENDING_ANALYSIS: "pending_analysis",
  NEEDS_SETUP: "needs_setup",
  READY_TO_REVIEW: "ready_to_review",
  DEFERRED_TO_DESKTOP: "deferred_to_desktop",
  MANUAL_REVIEW: "manual_review",
} as const

export type UnsortedInboxState = (typeof UNSORTED_INBOX_STATE)[keyof typeof UNSORTED_INBOX_STATE]

export type UnsortedPrimaryAction =
  | {
      kind: "analyze"
      label: string
      href?: undefined
    }
  | {
      kind: "open_details"
      label: string
      href?: undefined
    }
  | {
      kind: "open_settings"
      label: string
      href: string
    }

export type UnsortedInboxSummary = {
  id: string
  state: UnsortedInboxState
  stateLabel: string
  description: string
  reasonLabel: string | null
  primaryAction: UnsortedPrimaryAction
  defaultDetailsOpen: boolean
  requiresDesktop: boolean
  canAnalyze: boolean
  confidenceLabel: string | null
}

type UnsortedFileLike = {
  id: string
  filename: string
  mimetype: string
  metadata: unknown
  cachedParseResult: unknown
  isSplitted?: boolean
}

type BuildSummaryInput = {
  file: UnsortedFileLike
  llmConfigured: boolean
}

function hasDraft(parseResult: unknown) {
  if (!parseResult || typeof parseResult !== "object") {
    return false
  }

  return Object.values(parseResult).some((value) => value !== null && value !== undefined && value !== "")
}

function getReasonLabel(reasonCode?: string | null) {
  if (!reasonCode) {
    return null
  }

  if (reasonCode === "low_confidence") {
    return "Baja confianza"
  }

  if (reasonCode === "missing_critical_fields") {
    return "Faltan campos críticos"
  }

  if (reasonCode === "analysis_failed") {
    return "Análisis fallido"
  }

  return "Seguir en escritorio"
}

function getConfidenceLabel(confidence: string | null) {
  if (confidence === "high") {
    return "Alta confianza"
  }

  if (confidence === "medium") {
    return "Confianza media"
  }

  if (confidence === "low") {
    return "Baja confianza"
  }

  return null
}

export function buildUnsortedInboxSummary(input: BuildSummaryInput): UnsortedInboxSummary {
  const mobileTriage = readMobileTriageMetadata(input.file.metadata)
  const analyzable = canAnalyzeFileMimeType(input.file.mimetype)
  const draftAvailable = hasDraft(input.file.cachedParseResult)
  const confidence = draftAvailable ? getMobileConfidence(input.file.cachedParseResult as Record<string, unknown>) : null

  if (mobileTriage?.disposition === "deferred") {
    return {
      id: input.file.id,
      state: UNSORTED_INBOX_STATE.DEFERRED_TO_DESKTOP,
      stateLabel: "Pendiente de escritorio",
      description: "Este documento llegó desde móvil y necesita terminar la revisión aquí.",
      reasonLabel: getReasonLabel(mobileTriage.reasonCode),
      primaryAction: {
        kind: "open_details",
        label: "Continuar revisión",
      },
      defaultDetailsOpen: true,
      requiresDesktop: true,
      canAnalyze: analyzable,
      confidenceLabel: getConfidenceLabel(confidence),
    }
  }

  if (!analyzable) {
    return {
      id: input.file.id,
      state: UNSORTED_INBOX_STATE.MANUAL_REVIEW,
      stateLabel: "Revisión manual",
      description: getAnalyzeMimeTypeError(input.file.mimetype),
      reasonLabel: null,
      primaryAction: {
        kind: "open_details",
        label: "Completar a mano",
      },
      defaultDetailsOpen: true,
      requiresDesktop: false,
      canAnalyze: false,
      confidenceLabel: null,
    }
  }

  if (!input.llmConfigured) {
    return {
      id: input.file.id,
      state: UNSORTED_INBOX_STATE.NEEDS_SETUP,
      stateLabel: "Falta configurar IA",
      description: "Antes de analizar este documento tienes que activar un proveedor de IA.",
      reasonLabel: null,
      primaryAction: {
        kind: "open_settings",
        label: "Configurar IA",
        href: "/settings/llm",
      },
      defaultDetailsOpen: false,
      requiresDesktop: false,
      canAnalyze: true,
      confidenceLabel: null,
    }
  }

  if (draftAvailable) {
    return {
      id: input.file.id,
      state: UNSORTED_INBOX_STATE.READY_TO_REVIEW,
      stateLabel: "Listo para revisar",
      description: "Ya hay un borrador. Revisa lo crítico y guarda la transacción cuando toque.",
      reasonLabel: null,
      primaryAction: {
        kind: "open_details",
        label: "Revisar borrador",
      },
      defaultDetailsOpen: true,
      requiresDesktop: false,
      canAnalyze: true,
      confidenceLabel: getConfidenceLabel(confidence),
    }
  }

  return {
    id: input.file.id,
    state: UNSORTED_INBOX_STATE.PENDING_ANALYSIS,
    stateLabel: "Pendiente de análisis",
    description: "Todavía no hay borrador. Lanza el análisis para empezar a revisar.",
    reasonLabel: null,
    primaryAction: {
      kind: "analyze",
      label: "Analizar con IA",
    },
    defaultDetailsOpen: false,
    requiresDesktop: false,
    canAnalyze: true,
    confidenceLabel: null,
  }
}

export function buildUnsortedInboxItems(files: UnsortedFileLike[], input: { llmConfigured: boolean }) {
  return files.map((file) =>
    buildUnsortedInboxSummary({
      file,
      llmConfigured: input.llmConfigured,
    })
  )
}
