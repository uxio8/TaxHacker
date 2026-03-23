export const MOBILE_ITEM_STATE = {
  ANALYZING: "analyzing",
  READY_FOR_REVIEW: "ready_for_review",
  DEFERRED_TO_DESKTOP: "deferred_to_desktop",
  ERROR: "error",
} as const

export type MobileItemState = (typeof MOBILE_ITEM_STATE)[keyof typeof MOBILE_ITEM_STATE]

export const MOBILE_CONFIDENCE = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const

export type MobileConfidence = (typeof MOBILE_CONFIDENCE)[keyof typeof MOBILE_CONFIDENCE]

export const MOBILE_REASON_CODE = {
  ANALYSIS_FAILED: "analysis_failed",
  LLM_NOT_CONFIGURED: "llm_not_configured",
  LOW_CONFIDENCE: "low_confidence",
  MISSING_CRITICAL_FIELDS: "missing_critical_fields",
  STORAGE_UNAVAILABLE: "storage_unavailable",
  UNSUPPORTED_TYPE: "unsupported_type",
  USER_DEFERRED: "user_deferred",
  WORKER_UNAVAILABLE: "worker_unavailable",
} as const

export type MobileReasonCode = (typeof MOBILE_REASON_CODE)[keyof typeof MOBILE_REASON_CODE]

export interface MobileInboxItem {
  fileId: string
  filename: string
  previewUrl: string
  state: MobileItemState
  reasonCode: MobileReasonCode | null
  confidence: MobileConfidence | null
  analysisJobId: string | null
  updatedAt: string
}

export interface MobileCaptureItem {
  fileId: string
  state: MobileItemState
  reasonCode: MobileReasonCode | null
  confidence: MobileConfidence | null
  inboxUrl?: string | null
  reviewUrl?: string | null
}

export interface MobileSystemStatus {
  llmConfigured: boolean
  workerAvailable: boolean
  storageAvailable: boolean
  blockingReasonCode?: MobileReasonCode | null
}

export interface MobileInboxActionInput {
  fileId: string
  reviewUrl: string | null
  desktopUrl: string
  state: MobileItemState
}

export interface MobileInboxAction {
  href: string | null
  label: string
  disabled: boolean
}

export interface MobileStatusBanner {
  title: string
  description: string
}

export interface MobileGuidance {
  title: string
  description: string
}

export interface QuickReviewState {
  state: MobileItemState
  reasonCode: MobileReasonCode | null
  confidence: MobileConfidence | null
}

export interface ReviewEscalationInput {
  reasonCode: MobileReasonCode | null
  confidence: MobileConfidence | null
  desktopUrl: string
}

export interface ReviewEscalation {
  tone: "warning" | "destructive"
  reason: string
  desktopHref: string
}

export interface MobileReviewDraft {
  merchant: string
  issuedAt: string
  total: string
  currencyCode: string
  invoiceNumber: string
  categoryCode: string
}

export interface MobileReviewDraftDefaults {
  categoryCode: string
  currencyCode: string
}

export interface MobileReviewDraftInput {
  defaults: MobileReviewDraftDefaults
  parseResult: Record<string, unknown> | null | undefined
}

export function shouldPollInbox(items: MobileInboxItem[]) {
  return items.some((item) => item.state === MOBILE_ITEM_STATE.ANALYZING)
}

export function isQuickReviewEligible(input: QuickReviewState) {
  if (input.state !== MOBILE_ITEM_STATE.READY_FOR_REVIEW) {
    return false
  }

  if (input.reasonCode === MOBILE_REASON_CODE.LOW_CONFIDENCE || input.confidence === MOBILE_CONFIDENCE.LOW) {
    return false
  }

  return input.reasonCode !== MOBILE_REASON_CODE.ANALYSIS_FAILED
}

export function getInboxPrimaryAction(input: MobileInboxActionInput): MobileInboxAction {
  if (input.state === MOBILE_ITEM_STATE.READY_FOR_REVIEW && input.reviewUrl) {
    return {
      href: input.reviewUrl,
      label: "Revisar",
      disabled: false,
    }
  }

  if (input.state === MOBILE_ITEM_STATE.ANALYZING) {
    return {
      href: null,
      label: "Analizando",
      disabled: true,
    }
  }

  return {
    href: input.desktopUrl,
    label: "Escritorio",
    disabled: false,
  }
}

export function shouldShowDesktopShortcut(primaryAction: MobileInboxAction, desktopUrl: string) {
  return primaryAction.href !== desktopUrl || primaryAction.label !== "Escritorio"
}

export function getSystemStatusBanner(status: MobileSystemStatus): MobileStatusBanner | null {
  const blockingReason = status.blockingReasonCode
    ?? (!status.storageAvailable
      ? MOBILE_REASON_CODE.STORAGE_UNAVAILABLE
      : !status.llmConfigured
        ? MOBILE_REASON_CODE.LLM_NOT_CONFIGURED
        : !status.workerAvailable
          ? MOBILE_REASON_CODE.WORKER_UNAVAILABLE
          : null)

  if (!blockingReason) {
    return null
  }

  if (blockingReason === MOBILE_REASON_CODE.LLM_NOT_CONFIGURED) {
    return {
      title: "Configura el análisis",
      description: "Falta activar un proveedor para analizar documentos desde el móvil.",
    }
  }

  if (blockingReason === MOBILE_REASON_CODE.STORAGE_UNAVAILABLE) {
    return {
      title: "Sin almacenamiento disponible",
      description: "Libera espacio antes de seguir capturando documentos desde el móvil.",
    }
  }

  return {
    title: "Canal móvil en espera",
    description: "El worker de análisis no está disponible. Puedes seguir revisando en escritorio.",
  }
}

export function getHumanStateLabel(state: MobileItemState) {
  if (state === MOBILE_ITEM_STATE.ANALYZING) {
    return "Analizando"
  }

  if (state === MOBILE_ITEM_STATE.READY_FOR_REVIEW) {
    return "Lista para revisar"
  }

  if (state === MOBILE_ITEM_STATE.DEFERRED_TO_DESKTOP) {
    return "Pendiente de escritorio"
  }

  return "Error"
}

export function getReasonLabel(reasonCode: MobileReasonCode | null) {
  if (!reasonCode) {
    return null
  }

  if (reasonCode === MOBILE_REASON_CODE.MISSING_CRITICAL_FIELDS) {
    return "Faltan campos críticos"
  }

  if (reasonCode === MOBILE_REASON_CODE.LOW_CONFIDENCE) {
    return "Baja confianza"
  }

  if (reasonCode === MOBILE_REASON_CODE.ANALYSIS_FAILED) {
    return "Análisis fallido"
  }

  if (reasonCode === MOBILE_REASON_CODE.LLM_NOT_CONFIGURED) {
    return "Análisis sin configurar"
  }

  if (reasonCode === MOBILE_REASON_CODE.WORKER_UNAVAILABLE) {
    return "Worker no disponible"
  }

  if (reasonCode === MOBILE_REASON_CODE.STORAGE_UNAVAILABLE) {
    return "Sin almacenamiento"
  }

  return "Revisar en escritorio"
}

export function getInboxGuidance(item: Pick<MobileInboxItem, "state" | "reasonCode" | "confidence">): MobileGuidance {
  if (item.state === MOBILE_ITEM_STATE.ANALYZING) {
    return {
      title: "Déjalo en cola",
      description: "El análisis sigue en marcha. Cuando termine, podrás revisar lo crítico o mandarlo a escritorio.",
    }
  }

  if (item.state === MOBILE_ITEM_STATE.DEFERRED_TO_DESKTOP) {
    if (item.reasonCode === MOBILE_REASON_CODE.USER_DEFERRED) {
      return {
        title: "Termínalo en escritorio",
        description: "Lo marcaste para seguir allí sin perder el contexto del documento.",
      }
    }

    if (item.reasonCode === MOBILE_REASON_CODE.LOW_CONFIDENCE) {
      return {
        title: "Necesita más contexto",
        description: "La lectura no es fiable desde móvil. Ábrelo en escritorio para revisar el documento completo.",
      }
    }

    if (item.reasonCode === MOBILE_REASON_CODE.ANALYSIS_FAILED) {
      return {
        title: "El análisis no cerró bien",
        description: "Reintenta solo si hace falta; si no, termina la revisión desde escritorio.",
      }
    }

    return {
      title: "Sigue en escritorio",
      description: "Este documento necesita el flujo completo de escritorio para cerrarlo con seguridad.",
    }
  }

  if (item.reasonCode === MOBILE_REASON_CODE.LOW_CONFIDENCE || item.confidence === MOBILE_CONFIDENCE.LOW) {
    return {
      title: "Probablemente acabará en escritorio",
      description: "Puedes entrar a revisar, pero lo normal es completar este caso desde la vista completa.",
    }
  }

  if (item.reasonCode === MOBILE_REASON_CODE.MISSING_CRITICAL_FIELDS) {
    return {
      title: "Corrige solo lo crítico",
      description: "Completa proveedor, fecha, importe o moneda. Si falta más contexto, pásalo a escritorio.",
    }
  }

  if (item.state === MOBILE_ITEM_STATE.ERROR) {
    return {
      title: "Necesita reintento o escritorio",
      description: "El flujo móvil no puede cerrarlo ahora mismo. Reintenta el análisis o termínalo en escritorio.",
    }
  }

  return {
    title: "Puedes resolverlo aquí",
    description: "Revisa los campos clave y acepta si todo cuadra antes de seguir con el resto del día.",
  }
}

export function getReviewEscalation(input: ReviewEscalationInput): ReviewEscalation | null {
  if (input.reasonCode === MOBILE_REASON_CODE.LOW_CONFIDENCE || input.confidence === MOBILE_CONFIDENCE.LOW) {
    return {
      tone: "warning",
      reason: "La captura no da suficiente contexto para cerrarla desde el móvil. Revísala completa en escritorio.",
      desktopHref: input.desktopUrl,
    }
  }

  if (
    input.reasonCode === MOBILE_REASON_CODE.ANALYSIS_FAILED
    || input.reasonCode === MOBILE_REASON_CODE.WORKER_UNAVAILABLE
    || input.reasonCode === MOBILE_REASON_CODE.LLM_NOT_CONFIGURED
  ) {
    return {
      tone: "destructive",
      reason: "Este documento necesita el flujo completo de escritorio antes de darlo por bueno.",
      desktopHref: input.desktopUrl,
    }
  }

  return null
}

export function getReviewGuidance(input: QuickReviewState): MobileGuidance {
  if (input.reasonCode === MOBILE_REASON_CODE.MISSING_CRITICAL_FIELDS) {
    return {
      title: "Completa los críticos",
      description: "Corrige proveedor, fecha, importe y moneda. Si necesitas más campos, pásalo a escritorio.",
    }
  }

  if (input.state === MOBILE_ITEM_STATE.READY_FOR_REVIEW) {
    return {
      title: "Valida y acepta",
      description: "Si proveedor, fecha, importe y moneda cuadran, puedes aceptarlo aquí sin abrir el flujo completo.",
    }
  }

  return {
    title: "Siguiente paso recomendado",
    description: "Usa escritorio para terminar este documento con el contexto completo.",
  }
}

export function buildReviewUrl(fileId: string) {
  return `/capture/review/${fileId}`
}

export function buildDesktopUrl(fileId: string) {
  return `/unsorted#${fileId}`
}

export function getInitialReviewDraft(input: MobileReviewDraftInput): MobileReviewDraft {
  return {
    merchant: readString(input.parseResult, ["merchant"]),
    issuedAt: readString(input.parseResult, ["issuedAt", "issued_at", "date"]),
    total: readString(input.parseResult, ["total", "amount_total"]),
    currencyCode: readString(input.parseResult, ["currencyCode", "currency_code"]) || input.defaults.currencyCode,
    invoiceNumber: readString(input.parseResult, ["invoiceNumber", "invoice_number"]),
    categoryCode: readString(input.parseResult, ["categoryCode", "category_code"]) || input.defaults.categoryCode,
  }
}

function readString(source: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!source) {
    return ""
  }

  for (const key of keys) {
    const value = source[key]

    if (typeof value === "string" && value.trim() !== "") {
      return value.trim()
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value)
    }
  }

  return ""
}
