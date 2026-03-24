import { buildAnnualHandoffPack, getAnnualHandoffPackForOrganization, resolveAnnualHandoffFiscalYear } from "../fiscal/annual-handoff.ts"
import { getCounterparties } from "../fiscal/counterparties.ts"
import {
  getLegalArchivePeriodDetail,
  listLegalArchivePeriods,
  type LegalArchivePeriodDetail,
  type LegalArchivePeriodListItem,
} from "../fiscal/legal-archive.ts"
import {
  syncFiscalObligationsForOrganization,
  type FiscalObligationDetail,
  type FiscalObligationOwner,
  type FiscalObligationStatus,
} from "../fiscal/obligations.ts"
import { syncDefaultSpanishFiscalPeriodsV1 } from "../fiscal/periods.ts"
import { loadModel115DraftForTenant } from "../tax-forms/model-115-loader.ts"
import { loadModel111ManualForTenant } from "../tax-forms/model-111-manual.ts"
import { getModel347Gate } from "../tax-forms/model-347.ts"
import { getModel349Gate } from "../tax-forms/model-349.ts"
import { loadModel303ForTenant, type Model303Readiness } from "../tax-forms/model-303-loader.ts"
import { getTaxAttention, type TaxAttention } from "../tax-attention.ts"
import { buildFiscalWorkflowItems } from "./projectors/fiscal.ts"
import { buildWorkflowReadModelFromSlices } from "./rebuild.ts"
import type { WorkflowReadModel } from "./contracts.ts"

type BadgeVariant = "default" | "secondary" | "outline"
type QuarterlyCockpitCode = "303" | "115" | "111"
type AnnualCockpitCode = "180" | "390" | "347" | "349"

export type TaxWorkflowProfile = {
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

export type TaxWorkflowObligationItem = {
  code: string
  title: string
  periodLabel: string
  href: string
  statusLabel: string
  statusVariant: BadgeVariant
  dueDateLabel: string
  readinessLabel: string
  readinessVariant: BadgeVariant
  blockingItems: string[]
  responsibleLabel: string
  nextActionLabel: string
  nextActionHref: string
}

export type TaxWorkflowAnnualOverviewItem = {
  code: string
  title: string
  description: string
  href: string
  dueDateLabel: string
  statusLabel: string
  statusVariant: BadgeVariant
  responsibleLabel: string
  nextActionLabel: string
  nextActionHref: string
  operationalNote: string
}

export type TaxWorkflowAnnualOverview = {
  fiscalYear: number
  items: TaxWorkflowAnnualOverviewItem[]
  handoffHref: string
  handoffSummary: string
}

export type TaxWorkflowFiscalView = {
  attention: TaxAttention
  obligations: TaxWorkflowObligationItem[]
  annualOverview: TaxWorkflowAnnualOverview
  workflow: WorkflowReadModel<TaxAttention>
}

export type TaxArchiveWorkflowView = {
  periods: LegalArchivePeriodListItem[]
}

export type TaxArchivePeriodWorkflowView = {
  detail: LegalArchivePeriodDetail | null
}

export type AnnualArchiveWorkflowView = {
  fiscalYear: number
  pack: Awaited<ReturnType<typeof getAnnualHandoffPackForOrganization>>
}

type TaxWorkflowDependencies = {
  getTaxAttention?: typeof getTaxAttention
  loadModel303ForTenant?: typeof loadModel303ForTenant
  loadModel115DraftForTenant?: typeof loadModel115DraftForTenant
  loadModel111ManualForTenant?: typeof loadModel111ManualForTenant
  getCounterparties?: typeof getCounterparties
  syncFiscalObligationsForOrganization?: typeof syncFiscalObligationsForOrganization
}

type TaxArchiveDependencies = {
  syncDefaultSpanishFiscalPeriodsV1?: typeof syncDefaultSpanishFiscalPeriodsV1
  listLegalArchivePeriods?: typeof listLegalArchivePeriods
  getLegalArchivePeriodDetail?: typeof getLegalArchivePeriodDetail
}

type AnnualArchiveDependencies = {
  getAnnualHandoffPackForOrganization?: typeof getAnnualHandoffPackForOrganization
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

function resolveModel111Status(
  obligation: FiscalObligationDetail | null,
  applies: boolean
): FiscalObligationStatus {
  if (!applies) {
    return "not_applicable"
  }

  return normalizeFiscalStatus(obligation?.status) ?? "waiting_on_documents"
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
  code: AnnualCockpitCode,
  fiscalYear: number
) {
  return (
    obligations.find((obligation) => obligation.code === code && obligation.periodKey === `${fiscalYear}-Y`) ?? null
  )
}

function buildAnnualOverview(input: {
  fiscalYear: number
  profile: TaxWorkflowProfile
  obligations: FiscalObligationDetail[]
  counterparties: Awaited<ReturnType<typeof getCounterparties>>
}): TaxWorkflowAnnualOverview {
  const items: TaxWorkflowAnnualOverview["items"] = []
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
    pushAnnualItem({
      code: "180",
      title: "Modelo 180",
      description: "Resumen anual de alquileres con retención a partir del mismo núcleo que usa el 115.",
      obligation: findAnnualObligation(input.obligations, "180", input.fiscalYear),
    })
  }

  pushAnnualItem({
    code: "390",
    title: "Modelo 390",
    description: "Resumen anual de IVA consolidado desde el núcleo ya validado del 303.",
    obligation: findAnnualObligation(input.obligations, "390", input.fiscalYear),
  })

  const gate347 = getModel347Gate({
    fiscalYear: input.fiscalYear,
    profile: input.profile,
    counterparties: input.counterparties,
  })

  if (gate347.visible) {
    pushAnnualItem({
      code: "347",
      title: "Modelo 347",
      description: "Operaciones con terceros habilitadas porque la calidad de contrapartes ya es suficiente.",
      obligation: findAnnualObligation(input.obligations, "347", input.fiscalYear),
    })
  }

  const gate349 = getModel349Gate({
    fiscalYear: input.fiscalYear,
    profile: input.profile,
    counterparties: input.counterparties,
  })

  if (gate349.visible) {
    pushAnnualItem({
      code: "349",
      title: "Modelo 349",
      description: "Operaciones intracomunitarias activas con gate abierto por perfil fiscal y terceros.",
      obligation: findAnnualObligation(input.obligations, "349", input.fiscalYear),
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

function findObligation(
  obligations: FiscalObligationDetail[],
  code: FiscalObligationDetail["code"],
  periodKey: string
) {
  return obligations.find((obligation) => obligation.code === code && obligation.periodKey === periodKey) ?? null
}

export async function getTaxWorkflowFiscalView(
  input: {
    organizationId: string
    userId: string
    ownerScopeId: string
    profile: TaxWorkflowProfile
  },
  dependencies: TaxWorkflowDependencies = {}
): Promise<TaxWorkflowFiscalView> {
  const loadTaxAttention = dependencies.getTaxAttention ?? getTaxAttention
  const loadModel303 = dependencies.loadModel303ForTenant ?? loadModel303ForTenant
  const loadModel115 = dependencies.loadModel115DraftForTenant ?? loadModel115DraftForTenant
  const loadModel111 = dependencies.loadModel111ManualForTenant ?? loadModel111ManualForTenant
  const loadCounterparties = dependencies.getCounterparties ?? getCounterparties
  const syncObligations = dependencies.syncFiscalObligationsForOrganization ?? syncFiscalObligationsForOrganization

  const [attention, model303Data, model115Data, model111Data, counterparties, syncedObligations] = await Promise.all([
    loadTaxAttention(input.ownerScopeId),
    loadModel303({
      ownerScopeId: input.ownerScopeId,
    }),
    loadModel115({
      organizationId: input.organizationId,
      userId: input.userId,
    }),
    loadModel111({
      organizationId: input.organizationId,
      userId: input.userId,
    }),
    loadCounterparties(input.ownerScopeId),
    syncObligations(input.organizationId),
  ])

  const fiscalYear = resolveAnnualHandoffFiscalYear({
    annualCloseMonth: input.profile.annualCloseMonth,
  })

  const obligations = syncedObligations as FiscalObligationDetail[]
  const obligationsCockpit: TaxWorkflowObligationItem[] = []
  const quarterlyWorkflowObligations: FiscalObligationDetail[] = []

  if (model303Data) {
    const obligation303 = findObligation(obligations, "303", model303Data.periodKey)
    const effectiveStatus = resolveModel303Status(obligation303, model303Data.readiness)
    const nextAction = buildNextAction(effectiveStatus, "303", model303Data.periodKey)

    if (obligation303) {
      quarterlyWorkflowObligations.push(obligation303)
    }

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
    const obligation115 = findObligation(obligations, "115", model115Data.period.periodKey)
    const effectiveStatus = resolveModel115Status(obligation115, model115Data.readiness)
    const nextAction = buildNextAction(effectiveStatus, "115", model115Data.period.periodKey)
    const readiness = buildModel115Readiness(effectiveStatus, model115Data.readiness)

    if (obligation115) {
      quarterlyWorkflowObligations.push(obligation115)
    }

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
    const obligation111 = findObligation(obligations, "111_manual", model111Data.period.periodKey)
    const effectiveStatus = resolveModel111Status(obligation111, model111Data.manual.applies)
    const nextAction = buildNextAction(effectiveStatus, "111", model111Data.period.periodKey)
    const readiness = buildModel111Readiness(effectiveStatus, model111Data.manual.applies)

    if (obligation111) {
      quarterlyWorkflowObligations.push(obligation111)
    }

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
    attention,
    obligations: obligationsCockpit,
    annualOverview: buildAnnualOverview({
      fiscalYear,
      profile: input.profile,
      obligations,
      counterparties,
    }),
    workflow: buildWorkflowReadModelFromSlices({
      readiness: attention,
      items: buildFiscalWorkflowItems({
        obligations: quarterlyWorkflowObligations,
      }),
    }),
  }
}

export async function getTaxArchiveWorkflowView(
  input: {
    organizationId: string
    ownerScopeId: string
  },
  dependencies: TaxArchiveDependencies = {}
): Promise<TaxArchiveWorkflowView> {
  const syncPeriods = dependencies.syncDefaultSpanishFiscalPeriodsV1 ?? syncDefaultSpanishFiscalPeriodsV1
  const listPeriods = dependencies.listLegalArchivePeriods ?? listLegalArchivePeriods

  await syncPeriods(input.ownerScopeId)

  return {
    periods: await listPeriods(input.ownerScopeId, input.organizationId),
  }
}

export async function getTaxArchivePeriodWorkflowView(
  input: {
    organizationId: string
    ownerScopeId: string
    periodKey: string
  },
  dependencies: TaxArchiveDependencies = {}
): Promise<TaxArchivePeriodWorkflowView> {
  const syncPeriods = dependencies.syncDefaultSpanishFiscalPeriodsV1 ?? syncDefaultSpanishFiscalPeriodsV1
  const loadDetail = dependencies.getLegalArchivePeriodDetail ?? getLegalArchivePeriodDetail

  await syncPeriods(input.ownerScopeId)

  return {
    detail: await loadDetail(input.ownerScopeId, input.organizationId, input.periodKey),
  }
}

export async function getAnnualArchiveWorkflowView(
  input: {
    organizationId: string
    profile: TaxWorkflowProfile
  },
  dependencies: AnnualArchiveDependencies = {}
): Promise<AnnualArchiveWorkflowView> {
  const loadAnnualHandoffPack =
    dependencies.getAnnualHandoffPackForOrganization ?? getAnnualHandoffPackForOrganization
  const fiscalYear = resolveAnnualHandoffFiscalYear({
    annualCloseMonth: input.profile.annualCloseMonth,
  })

  return {
    fiscalYear,
    pack: await loadAnnualHandoffPack({
      organizationId: input.organizationId,
      profile: {
        annualCloseMonth: input.profile.annualCloseMonth,
        companyName: input.profile.companyName,
        organizationId: input.profile.organizationId,
        taxId: input.profile.taxId,
      },
      fiscalYear,
    }),
  }
}
