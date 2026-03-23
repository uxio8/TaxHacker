import { FiscalStorageNotReady } from "@/components/tax/fiscal-storage-not-ready"
import { TaxWorkspaceHeader } from "@/components/tax/layout/tax-workspace-header"
import { TaxWorkspaceSections } from "@/components/tax/layout/tax-workspace-sections"
import type { AnnualFiscalOverview } from "@/components/tax/obligations/annual-fiscal-overview-card"
import type { ObligationCockpitItem } from "@/components/tax/obligations/obligations-cockpit"
import { getCurrentUser } from "@/lib/auth"
import { createPageMetadata, createTranslator } from "@/lib/i18n"
import { requireCurrentOrganizationId } from "@/lib/tenant"
import { buildAnnualHandoffPack, resolveAnnualHandoffFiscalYear } from "@/models/fiscal/annual-handoff"
import { getCounterparties } from "@/models/fiscal/counterparties"
import {
  getFiscalObligationByCodeAndPeriod,
  syncFiscalObligationsForOrganization,
  type FiscalObligationDetail,
  type FiscalObligationOwner,
  type FiscalObligationStatus,
} from "@/models/fiscal/obligations"
import { getFiscalProfileAccessByOrganizationId } from "@/models/fiscal/profile"
import { isFiscalStorageNotReadyError } from "@/models/fiscal/storage"
import { loadModel115DraftForTenant } from "@/models/tax-forms/model-115-loader"
import { loadModel111ManualForTenant } from "@/models/tax-forms/model-111-manual"
import { loadModel303ForTenant, type Model303Readiness } from "@/models/tax-forms/model-303-loader"
import { getModel347Gate } from "@/models/tax-forms/model-347"
import { getModel349Gate } from "@/models/tax-forms/model-349"
import { getTaxAttention } from "@/models/tax-attention"

export const metadata = createPageMetadata("tax.title", {
  descriptionKey: "tax.description",
})

type BadgeVariant = "default" | "secondary" | "outline"
type QuarterlyCockpitCode = "303" | "115" | "111"
type AnnualCockpitCode = "180" | "390" | "347" | "349"
type TaxWorkspaceProfile = {
  organizationId: string
  companyName: string
  taxId: string
  annualCloseMonth: number
  issuesInvoices: boolean
  hasRentWithholding: boolean
  hasIntraEuOperations: boolean
  hasEmployees: boolean
  hasProfessionalWithholding: boolean
}

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

function resolveDueDateLabel(
  code: QuarterlyCockpitCode,
  periodKey: string,
  obligation: FiscalObligationDetail | null
) {
  return formatDueDate(obligation?.dueDate ?? buildQuarterDueDate(code, periodKey))
}

function resolveAnnualDueDateLabel(
  code: AnnualCockpitCode,
  fiscalYear: number,
  obligation: FiscalObligationDetail | null
) {
  return formatDueDate(obligation?.dueDate ?? buildAnnualDueDate(code, fiscalYear))
}

function normalizeBlockingReasons(obligation?: FiscalObligationDetail | null) {
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

function normalizeFiscalStatus(value: string | null | undefined): FiscalObligationStatus | null {
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

function normalizeFiscalOwner(value: string | null | undefined): FiscalObligationOwner | null {
  if (value === "client" || value === "advisor" || value === "shared" || value === "system") {
    return value
  }

  return null
}

function resolveModel303Status(
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

function resolveModel115Status(
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

function getStatusLabel(status: FiscalObligationStatus) {
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

function getStatusVariant(status: FiscalObligationStatus): BadgeVariant {
  if (status === "ready_to_file" || status === "filed") {
    return "default"
  }

  if (status === "not_applicable" || status === "archived") {
    return "outline"
  }

  return "secondary"
}

function getResponsibleLabel(
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

function getAnnualResponsibleLabel(
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

function buildNextAction(status: FiscalObligationStatus, code: QuarterlyCockpitCode, periodKey: string) {
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

function buildAnnualNextAction(
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

function buildAnnualOperationalNote(
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

function buildModel303BlockingItems(
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

function buildModel115BlockingItems(
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
    items.push(
      formatDocumentCount(
        readiness.blocked_document_count,
        "factura bloqueada",
        "facturas bloqueadas"
      )
    )
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
    items.push(
      formatDocumentCount(
        readiness.pending_document_count,
        "factura pendiente",
        "facturas pendientes"
      )
    )
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

function buildModel115Readiness(status: FiscalObligationStatus, readiness: {
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

function resolveModel111Status(
  obligation: FiscalObligationDetail | null,
  applies: boolean
): FiscalObligationStatus {
  if (!applies) {
    return "not_applicable"
  }

  return normalizeFiscalStatus(obligation?.status) ?? "waiting_on_documents"
}

function buildModel111BlockingItems(
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

function buildModel111Readiness(status: FiscalObligationStatus, applies: boolean) {
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

function findAnnualObligation(
  obligations: FiscalObligationDetail[],
  code: "180" | "390" | "347" | "349",
  fiscalYear: number
) {
  return (
    obligations.find((obligation) => obligation.code === code && obligation.periodKey === `${fiscalYear}-Y`) ?? null
  )
}

function buildAnnualOverview(input: {
  fiscalYear: number
  profile: TaxWorkspaceProfile
  obligations: FiscalObligationDetail[]
  counterparties: Awaited<ReturnType<typeof getCounterparties>>
}): AnnualFiscalOverview {
  const items: AnnualFiscalOverview["items"] = []
  const pushAnnualItem = (inputItem: {
    code: AnnualCockpitCode
    title: string
    description: string
    obligation: FiscalObligationDetail | null
  }) => {
    const status = normalizeFiscalStatus(inputItem.obligation?.status) ?? "waiting_on_documents"
    const nextAction = buildAnnualNextAction(status, inputItem.code, input.fiscalYear)

    items.push({
      code: inputItem.code,
      title: inputItem.title,
      description: inputItem.description,
      href: `/tax/forms/${inputItem.code}?period=${input.fiscalYear}-Y`,
      dueDateLabel: resolveAnnualDueDateLabel(inputItem.code, input.fiscalYear, inputItem.obligation),
      statusLabel: getStatusLabel(status),
      statusVariant: getStatusVariant(status),
      responsibleLabel: getAnnualResponsibleLabel(
        status,
        normalizeFiscalOwner(inputItem.obligation?.owner)
      ),
      nextActionLabel: nextAction.label,
      nextActionHref: nextAction.href,
      operationalNote: buildAnnualOperationalNote(status, inputItem.obligation),
    })
  }

  if (input.profile.hasRentWithholding) {
    const obligation180 = findAnnualObligation(input.obligations, "180", input.fiscalYear)
    pushAnnualItem({
      code: "180",
      title: "Modelo 180",
      description: "Resumen anual de alquileres con retención a partir del mismo núcleo que usa el 115.",
      obligation: obligation180,
    })
  }

  const obligation390 = findAnnualObligation(input.obligations, "390", input.fiscalYear)
  pushAnnualItem({
    code: "390",
    title: "Modelo 390",
    description: "Resumen anual de IVA consolidado desde el núcleo ya validado del 303.",
    obligation: obligation390,
  })

  const gate347 = getModel347Gate({
    fiscalYear: input.fiscalYear,
    profile: input.profile,
    counterparties: input.counterparties,
  })

  if (gate347.visible) {
    const obligation347 = findAnnualObligation(input.obligations, "347", input.fiscalYear)
    pushAnnualItem({
      code: "347",
      title: "Modelo 347",
      description: "Operaciones con terceros habilitadas porque la calidad de contrapartes ya es suficiente.",
      obligation: obligation347,
    })
  }

  const gate349 = getModel349Gate({
    fiscalYear: input.fiscalYear,
    profile: input.profile,
    counterparties: input.counterparties,
  })

  if (gate349.visible) {
    const obligation349 = findAnnualObligation(input.obligations, "349", input.fiscalYear)
    pushAnnualItem({
      code: "349",
      title: "Modelo 349",
      description: "Operaciones intracomunitarias activas con gate abierto por perfil fiscal y terceros.",
      obligation: obligation349,
    })
  }

  const annualHandoff = buildAnnualHandoffPack({
    fiscalYear: input.fiscalYear,
    profile: {
      annualCloseMonth: input.profile.annualCloseMonth,
      companyName: input.profile.companyName,
      organizationId: input.profile.organizationId,
      taxId: input.profile.taxId,
    },
    obligations: input.obligations.filter((obligation) => obligation.fiscalYear === input.fiscalYear),
  })

  return {
    fiscalYear: input.fiscalYear,
    items,
    handoffHref: "/tax/archive/annual",
    handoffSummary: `${annualHandoff.summary.readyOrFiledItems}/${annualHandoff.summary.totalItems} ítems listos o presentados, ${annualHandoff.summary.blockedItems} con bloqueos.`,
  }
}

type TaxWorkspaceData = {
  obligations: ObligationCockpitItem[]
  annualOverview: AnnualFiscalOverview
}

async function loadTaxWorkspaceData(input: {
  organizationId: string
  userId: string
  ownerScopeId: string
  profile: TaxWorkspaceProfile
}): Promise<TaxWorkspaceData> {
  const [model303Data, model115Data, model111Data, counterparties] = await Promise.all([
    loadModel303ForTenant({
      ownerScopeId: input.ownerScopeId,
    }),
    loadModel115DraftForTenant({
      organizationId: input.organizationId,
      userId: input.userId,
    }),
    loadModel111ManualForTenant({
      organizationId: input.organizationId,
      userId: input.userId,
    }),
    getCounterparties(input.ownerScopeId),
  ])

  const syncedObligations = await syncFiscalObligationsForOrganization(input.organizationId)
  const fiscalYear = resolveAnnualHandoffFiscalYear({
    annualCloseMonth: input.profile.annualCloseMonth,
  })

  const [obligation303, obligation115, obligation111] = await Promise.all([
    model303Data
      ? getFiscalObligationByCodeAndPeriod(input.organizationId, "303", model303Data.periodKey)
      : Promise.resolve(null),
    model115Data.status === "ready"
      ? getFiscalObligationByCodeAndPeriod(input.organizationId, "115", model115Data.period.periodKey)
      : Promise.resolve(null),
    model111Data.status === "ready"
      ? getFiscalObligationByCodeAndPeriod(input.organizationId, "111_manual", model111Data.period.periodKey)
      : Promise.resolve(null),
  ])

  const obligationsCockpit: ObligationCockpitItem[] = []

  if (model303Data) {
    const effectiveStatus = resolveModel303Status(obligation303, model303Data.readiness)
    const nextAction = buildNextAction(effectiveStatus, "303", model303Data.periodKey)

    obligationsCockpit.push({
      code: "303",
      title: "Modelo 303",
      periodLabel: model303Data.periodKey,
      href: `/tax/forms/303?period=${model303Data.periodKey}`,
      statusLabel: getStatusLabel(effectiveStatus),
      statusVariant: getStatusVariant(effectiveStatus),
      dueDateLabel: resolveDueDateLabel("303", model303Data.periodKey, obligation303),
      readinessLabel:
        effectiveStatus === "not_applicable" ? "No aplica" : model303Data.readiness.label,
      readinessVariant:
        effectiveStatus === "not_applicable"
          ? "outline"
          : model303Data.readiness.status === "ready"
            ? "default"
            : "secondary",
      blockingItems: buildModel303BlockingItems(
        obligation303,
        model303Data.readiness,
        effectiveStatus
      ),
      responsibleLabel: getResponsibleLabel(
        effectiveStatus,
        normalizeFiscalOwner(obligation303?.owner)
      ),
      nextActionLabel: nextAction.label,
      nextActionHref: nextAction.href,
    })
  }

  if (model115Data.status === "ready") {
    const effectiveStatus = resolveModel115Status(obligation115, model115Data.readiness)
    const nextAction = buildNextAction(effectiveStatus, "115", model115Data.period.periodKey)
    const readiness = buildModel115Readiness(effectiveStatus, model115Data.readiness)

    obligationsCockpit.push({
      code: "115",
      title: "Modelo 115",
      periodLabel: model115Data.period.periodKey,
      href: `/tax/forms/115?period=${model115Data.period.periodKey}`,
      statusLabel: getStatusLabel(effectiveStatus),
      statusVariant: getStatusVariant(effectiveStatus),
      dueDateLabel: resolveDueDateLabel("115", model115Data.period.periodKey, obligation115),
      readinessLabel: readiness.label,
      readinessVariant: readiness.variant,
      blockingItems: buildModel115BlockingItems(
        obligation115,
        model115Data.readiness,
        effectiveStatus
      ),
      responsibleLabel: getResponsibleLabel(
        effectiveStatus,
        normalizeFiscalOwner(obligation115?.owner)
      ),
      nextActionLabel: nextAction.label,
      nextActionHref: nextAction.href,
      })
  }

  if (model111Data.status === "ready") {
    const effectiveStatus = resolveModel111Status(obligation111, model111Data.manual.applies)
    const nextAction = buildNextAction(effectiveStatus, "111", model111Data.period.periodKey)
    const readiness = buildModel111Readiness(effectiveStatus, model111Data.manual.applies)

    obligationsCockpit.push({
      code: "111",
      title: "Modelo 111 manual",
      periodLabel: model111Data.period.periodKey,
      href: `/tax/forms/111?period=${model111Data.period.periodKey}`,
      statusLabel: getStatusLabel(effectiveStatus),
      statusVariant: getStatusVariant(effectiveStatus),
      dueDateLabel: resolveDueDateLabel("111", model111Data.period.periodKey, obligation111),
      readinessLabel: readiness.label,
      readinessVariant: readiness.variant,
      blockingItems: buildModel111BlockingItems(
        obligation111,
        model111Data.manual.applies,
        effectiveStatus
      ),
      responsibleLabel: getResponsibleLabel(
        effectiveStatus,
        normalizeFiscalOwner(obligation111?.owner)
      ),
      nextActionLabel: nextAction.label,
      nextActionHref: nextAction.href,
    })
  }

  return {
    obligations: obligationsCockpit,
    annualOverview: buildAnnualOverview({
      fiscalYear,
      profile: input.profile,
      obligations: syncedObligations as FiscalObligationDetail[],
      counterparties,
    }),
  }
}

export default async function TaxPage() {
  const t = createTranslator()
  const user = await getCurrentUser()
  const organizationId = await requireCurrentOrganizationId({
    getCurrentUser: async () => user,
  })
  const fiscalProfileAccess = await getFiscalProfileAccessByOrganizationId(organizationId, user.id)

  if (fiscalProfileAccess.status === "storage_not_ready") {
    return (
      <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
        <TaxWorkspaceHeader t={t} attention={null} companyName={null} companyTaxId={null} />
        <FiscalStorageNotReady t={t} />
      </main>
    )
  }

  if (fiscalProfileAccess.status !== "ready") {
    return (
      <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
        <TaxWorkspaceHeader t={t} attention={null} companyName={null} companyTaxId={null} />
        <TaxWorkspaceSections t={t} attention={null} setupHref="/settings/fiscal" />
      </main>
    )
  }

  let attention = null
  let obligationsCockpit: ObligationCockpitItem[] = []
  let annualOverview: AnnualFiscalOverview | undefined

  try {
    const [nextAttention, nextWorkspaceData] = await Promise.all([
      getTaxAttention(fiscalProfileAccess.profile.id),
      loadTaxWorkspaceData({
        organizationId,
        userId: user.id,
        ownerScopeId: fiscalProfileAccess.profile.id,
        profile: {
          annualCloseMonth: fiscalProfileAccess.profile.annualCloseMonth,
          companyName: fiscalProfileAccess.profile.companyName,
          hasEmployees: fiscalProfileAccess.profile.hasEmployees,
          hasIntraEuOperations: fiscalProfileAccess.profile.hasIntraEuOperations,
          hasProfessionalWithholding: fiscalProfileAccess.profile.hasProfessionalWithholding,
          hasRentWithholding: fiscalProfileAccess.profile.hasRentWithholding,
          issuesInvoices: fiscalProfileAccess.profile.issuesInvoices,
          organizationId,
          taxId: fiscalProfileAccess.profile.taxId,
        },
      }),
    ])

    attention = nextAttention
    obligationsCockpit = nextWorkspaceData.obligations
    annualOverview = nextWorkspaceData.annualOverview
  } catch (error) {
    if (isFiscalStorageNotReadyError(error)) {
      return (
        <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
          <TaxWorkspaceHeader
            t={t}
            attention={null}
            companyName={fiscalProfileAccess.profile.companyName}
            companyTaxId={fiscalProfileAccess.profile.taxId}
          />
          <FiscalStorageNotReady t={t} />
        </main>
      )
    }

    throw error
  }

  return (
    <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
      <TaxWorkspaceHeader
        t={t}
        attention={attention}
        companyName={fiscalProfileAccess.profile.companyName}
        companyTaxId={fiscalProfileAccess.profile.taxId}
      />
      <TaxWorkspaceSections
        t={t}
        attention={attention}
        obligations={obligationsCockpit}
        annualOverview={annualOverview}
      />
    </main>
  )
}
