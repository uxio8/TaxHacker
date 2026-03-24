import type { FiscalObligationDetail, FiscalObligationOwner, FiscalObligationStatus } from "../../fiscal/obligations.ts"
import type { Model303Readiness } from "../../tax-forms/model-303-loader.ts"
import type {
  AnnualCockpitCode,
  QuarterlyCockpitCode,
} from "./types.ts"

function makeUtcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day))
}

function buildQuarterDueDate(code: QuarterlyCockpitCode, periodKey: string) {
  const match = /^(\d{4})-Q([1-4])$/.exec(periodKey)

  if (!match) {
    return null
  }

  const fiscalYear = Number.parseInt(match[1] ?? "", 10)
  const quarter = Number.parseInt(match[2] ?? "", 10)

  if (code === "303") {
    if (quarter === 1) return makeUtcDate(fiscalYear, 4, 20)
    if (quarter === 2) return makeUtcDate(fiscalYear, 7, 20)
    if (quarter === 3) return makeUtcDate(fiscalYear, 10, 20)
    return makeUtcDate(fiscalYear + 1, 1, 30)
  }

  if (quarter === 1) return makeUtcDate(fiscalYear, 4, 20)
  if (quarter === 2) return makeUtcDate(fiscalYear, 7, 20)
  if (quarter === 3) return makeUtcDate(fiscalYear, 10, 20)
  return makeUtcDate(fiscalYear + 1, 1, 20)
}

function buildAnnualDueDate(code: AnnualCockpitCode, fiscalYear: number) {
  if (code === "180" || code === "390" || code === "349") {
    return makeUtcDate(fiscalYear + 1, 1, 30)
  }

  return makeUtcDate(fiscalYear + 1, 2, 28)
}

function formatDueDate(value: Date | string | null | undefined) {
  if (!value) {
    return "Sin vencimiento configurado"
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Sin vencimiento configurado"
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)
}

export function resolveDueDateLabel(
  code: QuarterlyCockpitCode,
  periodKey: string,
  obligation: FiscalObligationDetail | null
) {
  return formatDueDate(obligation?.dueDate ?? buildQuarterDueDate(code, periodKey))
}

export function resolveAnnualDueDateLabel(
  code: AnnualCockpitCode,
  fiscalYear: number,
  obligation: FiscalObligationDetail | null
) {
  return formatDueDate(obligation?.dueDate ?? buildAnnualDueDate(code, fiscalYear))
}

export function normalizeBlockingReasons(obligation?: FiscalObligationDetail | null) {
  if (!Array.isArray(obligation?.blockingReasons)) {
    return []
  }

  return obligation.blockingReasons.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
}

function formatDocumentCount(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`
}

function isManualFiscalStatus(status: FiscalObligationStatus | null | undefined) {
  return (
    status === "draft_ready" ||
    status === "ready_to_file" ||
    status === "filed" ||
    status === "archived" ||
    status === "not_applicable"
  )
}

export function normalizeFiscalStatus(value: string | null | undefined): FiscalObligationStatus | null {
  if (
    value === "not_applicable" ||
    value === "waiting_on_documents" ||
    value === "needs_review" ||
    value === "ready_to_prepare" ||
    value === "draft_ready" ||
    value === "ready_to_file" ||
    value === "filed" ||
    value === "archived"
  ) {
    return value
  }

  return null
}

export function normalizeFiscalOwner(value: string | null | undefined): FiscalObligationOwner | null {
  if (value === "client" || value === "advisor" || value === "shared" || value === "system") {
    return value
  }

  return null
}

export function resolveModel303Status(
  obligation: FiscalObligationDetail | null,
  readiness: Model303Readiness
): FiscalObligationStatus {
  const normalizedStatus = normalizeFiscalStatus(obligation?.status)

  if (isManualFiscalStatus(normalizedStatus)) {
    return normalizedStatus
  }

  if (readiness.status === "ready") {
    return "ready_to_prepare"
  }

  if (
    readiness.summary.blockingDocumentCount > 0 ||
    readiness.summary.reviewDocumentCount > 0 ||
    readiness.summary.skippedDocumentCount > 0
  ) {
    return "needs_review"
  }

  return "waiting_on_documents"
}

export function resolveModel115Status(
  obligation: FiscalObligationDetail | null,
  readiness: {
    candidate_document_count: number
    included_document_count: number
    blocked_document_count: number
    needs_review_document_count: number
    pending_document_count: number
  }
): FiscalObligationStatus {
  const normalizedStatus = normalizeFiscalStatus(obligation?.status)

  if (isManualFiscalStatus(normalizedStatus)) {
    return normalizedStatus
  }

  if (
    readiness.blocked_document_count > 0 ||
    readiness.needs_review_document_count > 0 ||
    readiness.pending_document_count > 0
  ) {
    return "needs_review"
  }

  if (readiness.included_document_count > 0 || readiness.candidate_document_count > 0) {
    return "ready_to_prepare"
  }

  return "waiting_on_documents"
}

export function resolveModel111Status(
  obligation: FiscalObligationDetail | null,
  applies: boolean
): FiscalObligationStatus {
  if (!applies) {
    return "not_applicable"
  }

  return normalizeFiscalStatus(obligation?.status) ?? "waiting_on_documents"
}

export function getStatusLabel(status: FiscalObligationStatus) {
  switch (status) {
    case "not_applicable":
      return "No aplica"
    case "waiting_on_documents":
      return "Esperando documentación"
    case "needs_review":
      return "Requiere revisión"
    case "ready_to_prepare":
      return "Listo para preparar"
    case "draft_ready":
      return "Borrador listo"
    case "ready_to_file":
      return "Listo para presentar"
    case "filed":
      return "Presentado"
    case "archived":
      return "Archivado"
  }
}

export function getStatusVariant(status: FiscalObligationStatus) {
  if (status === "ready_to_file" || status === "filed") {
    return "default" as const
  }

  if (status === "not_applicable" || status === "archived") {
    return "outline" as const
  }

  return "secondary" as const
}

export function getResponsibleLabel(
  status: FiscalObligationStatus,
  owner: FiscalObligationOwner | null | undefined
) {
  if (status === "not_applicable" || status === "archived" || owner === "system") {
    return "Sistema"
  }

  if (owner === "client" || status === "waiting_on_documents") {
    return "Cliente"
  }

  if (owner === "shared" || status === "needs_review") {
    return "Cliente / Asesoría"
  }

  return "Asesoría"
}

export function getAnnualResponsibleLabel(
  status: FiscalObligationStatus,
  owner: FiscalObligationOwner | null | undefined
) {
  if (status === "not_applicable" || status === "archived" || owner === "system") {
    return "Sistema"
  }

  if (owner === "client") {
    return "Cliente"
  }

  if (owner === "shared") {
    return "Cliente / Asesoría"
  }

  return "Asesoría"
}

export function buildNextAction(status: FiscalObligationStatus, code: QuarterlyCockpitCode, periodKey: string) {
  const formCode = code === "111" ? "111" : code
  const formHref = `/tax/forms/${formCode}?period=${periodKey}`

  switch (status) {
    case "not_applicable":
      return {
        label: "Revisar perfil fiscal",
        href: "/settings/fiscal",
      }
    case "waiting_on_documents":
      return {
        label: code === "111" ? "Abrir resumen manual" : "Completar documentación",
        href: code === "111" ? formHref : "/tax/review",
      }
    case "needs_review":
      return {
        label: code === "111" ? "Completar evidencia externa" : "Resolver bloqueos",
        href: code === "111" ? formHref : "/tax/review",
      }
    case "ready_to_prepare":
      return {
        label: code === "111" ? "Completar resumen manual" : "Abrir borrador",
        href: formHref,
      }
    case "draft_ready":
      return {
        label: "Completar expediente",
        href: formHref,
      }
    case "ready_to_file":
      return {
        label: "Preparar presentación",
        href: formHref,
      }
    case "filed":
      return {
        label: "Ver expediente",
        href: formHref,
      }
    case "archived":
      return {
        label: "Abrir archivo",
        href: `/tax/archive/${periodKey}`,
      }
  }
}

export function buildAnnualNextAction(
  status: FiscalObligationStatus,
  code: AnnualCockpitCode,
  fiscalYear: number
) {
  const formHref = `/tax/forms/${code}?period=${fiscalYear}-Y`

  switch (status) {
    case "not_applicable":
      return {
        label: "Revisar perfil fiscal",
        href: "/settings/fiscal",
      }
    case "waiting_on_documents":
      return {
        label: "Completar evidencia anual",
        href: formHref,
      }
    case "needs_review":
      return {
        label: "Resolver bloqueos",
        href: formHref,
      }
    case "ready_to_prepare":
      return {
        label: "Abrir borrador",
        href: formHref,
      }
    case "draft_ready":
      return {
        label: "Completar expediente",
        href: formHref,
      }
    case "ready_to_file":
      return {
        label: "Preparar presentación",
        href: formHref,
      }
    case "filed":
      return {
        label: "Ver expediente",
        href: formHref,
      }
    case "archived":
      return {
        label: "Abrir archivo anual",
        href: "/tax/archive/annual",
      }
  }
}

export function buildAnnualOperationalNote(
  status: FiscalObligationStatus,
  obligation: FiscalObligationDetail | null
) {
  const blockingReasons = normalizeBlockingReasons(obligation)

  if (blockingReasons.length > 0) {
    return `${blockingReasons.length} ${blockingReasons.length === 1 ? "bloqueo activo" : "bloqueos activos"} en el expediente anual.`
  }

  switch (status) {
    case "not_applicable":
      return "Fuera de alcance según el perfil fiscal actual."
    case "waiting_on_documents":
      return "Pendiente de consolidar el expediente anual."
    case "needs_review":
      return "Hay incidencias fiscales o documentales por cerrar."
    case "ready_to_prepare":
      return "La obligación ya tiene base suficiente para preparar borrador."
    case "draft_ready":
      return "El borrador anual está listo y falta cerrar el expediente."
    case "ready_to_file":
      return "El expediente anual está completo y queda presentar."
    case "filed":
      return "Presentado y pendiente solo de archivo o seguimiento."
    case "archived":
      return "Archivado dentro del cierre anual."
  }
}

export function buildModel303BlockingItems(
  obligation: FiscalObligationDetail | null,
  readiness: Model303Readiness,
  status: FiscalObligationStatus
) {
  const items = [...normalizeBlockingReasons(obligation)]

  if (readiness.summary.blockingDocumentCount > 0) {
    items.push(
      formatDocumentCount(
        readiness.summary.blockingDocumentCount,
        "documento bloqueado",
        "documentos bloqueados"
      )
    )
  }

  if (readiness.summary.reviewDocumentCount > 0) {
    items.push(
      formatDocumentCount(
        readiness.summary.reviewDocumentCount,
        "documento pendiente de revisión",
        "documentos pendientes de revisión"
      )
    )
  }

  if (readiness.summary.skippedDocumentCount > 0) {
    items.push(
      formatDocumentCount(
        readiness.summary.skippedDocumentCount,
        "documento fuera del borrador",
        "documentos fuera del borrador"
      )
    )
  }

  if (items.length === 0 && status === "waiting_on_documents") {
    items.push("Sin documentos con impacto en IVA listos para el trimestre.")
  }

  return items.length > 0 ? items : ["Sin bloqueos activos."]
}

export function buildModel115BlockingItems(
  obligation: FiscalObligationDetail | null,
  readiness: {
    blocked_document_count: number
    needs_review_document_count: number
    pending_document_count: number
    candidate_document_count: number
  },
  status: FiscalObligationStatus
) {
  const items = [...normalizeBlockingReasons(obligation)]

  if (readiness.blocked_document_count > 0) {
    items.push(formatDocumentCount(readiness.blocked_document_count, "factura bloqueada", "facturas bloqueadas"))
  }

  if (readiness.needs_review_document_count > 0) {
    items.push(
      formatDocumentCount(
        readiness.needs_review_document_count,
        "factura pendiente de revisión",
        "facturas pendientes de revisión"
      )
    )
  }

  if (readiness.pending_document_count > 0) {
    items.push(formatDocumentCount(readiness.pending_document_count, "factura pendiente", "facturas pendientes"))
  }

  if (items.length === 0 && status === "waiting_on_documents") {
    items.push(
      readiness.candidate_document_count > 0
        ? "Todavía no hay líneas listas para retención en el trimestre."
        : "Sin facturas de alquiler listas para el 115."
    )
  }

  return items.length > 0 ? items : ["Sin bloqueos activos."]
}

export function buildModel115Readiness(status: FiscalObligationStatus, readiness: {
  candidate_document_count: number
  blocked_document_count: number
  needs_review_document_count: number
  pending_document_count: number
}) {
  if (status === "not_applicable") {
    return {
      label: "No aplica",
      variant: "outline" as const,
    }
  }

  if (
    readiness.blocked_document_count > 0 ||
    readiness.needs_review_document_count > 0 ||
    readiness.pending_document_count > 0
  ) {
    return {
      label: "Requiere atención",
      variant: "secondary" as const,
    }
  }

  if (readiness.candidate_document_count > 0) {
    return {
      label: "Listo para preparar",
      variant: "default" as const,
    }
  }

  return {
    label: "Sin hechos listos",
    variant: "secondary" as const,
  }
}

export function buildModel111BlockingItems(
  obligation: FiscalObligationDetail | null,
  applies: boolean,
  status: FiscalObligationStatus
) {
  const items = [...normalizeBlockingReasons(obligation)]

  if (!applies) {
    items.push("El perfil fiscal no declara empleados ni retenciones profesionales.")
  } else if (items.length === 0 && status === "waiting_on_documents") {
    items.push("Falta el resumen externo y el justificante final del trimestre.")
  }

  return items.length > 0 ? items : ["Sin bloqueos activos."]
}

export function buildModel111Readiness(status: FiscalObligationStatus, applies: boolean) {
  if (!applies || status === "not_applicable") {
    return {
      label: "No aplica",
      variant: "outline" as const,
    }
  }

  if (status === "draft_ready" || status === "ready_to_file" || status === "filed" || status === "archived") {
    return {
      label: "Resumen manual actualizado",
      variant: "default" as const,
    }
  }

  return {
    label: "Pendiente de evidencia externa",
    variant: "secondary" as const,
  }
}

export function findAnnualObligation(
  obligations: FiscalObligationDetail[],
  code: AnnualCockpitCode,
  fiscalYear: number
) {
  return obligations.find((obligation) => obligation.code === code && obligation.periodKey === `${fiscalYear}-Y`) ?? null
}

export function findObligation(
  obligations: FiscalObligationDetail[],
  code: FiscalObligationDetail["code"],
  periodKey: string
) {
  return obligations.find((obligation) => obligation.code === code && obligation.periodKey === periodKey) ?? null
}
