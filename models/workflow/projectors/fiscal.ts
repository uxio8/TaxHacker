import {
  WORKFLOW_CONFIDENCE,
  WORKFLOW_ITEM_SOURCE,
  WORKFLOW_ITEM_STATUS,
  WORKFLOW_MATERIALITY,
  WORKFLOW_SURFACE,
  type WorkflowItem,
} from "../contracts.ts"

type FiscalObligationLike = {
  id: string
  code: string
  periodKey: string
  status: string
  owner: string
  dueDate: string | Date | null
  blockingReasons: string[] | unknown
}

type DossierLike = {
  filingReceiptFileId: string | null
}

type Input = {
  obligations: FiscalObligationLike[]
  dossiersByObligationId?: Record<string, DossierLike | undefined>
}

function normalizeBlockingReasons(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0) : []
}

function normalizeWorkflowObligationCode(code: string) {
  return code === "111_manual" ? "111" : code
}

function buildObligationHref(code: string, periodKey: string) {
  const normalizedCode = normalizeWorkflowObligationCode(code)
  return `/tax/forms/${normalizedCode}?period=${encodeURIComponent(periodKey)}`
}

function buildFiscalNextAction(status: string, code: string, periodKey: string) {
  const href = buildObligationHref(code, periodKey)

  if (status === "not_applicable") {
    return {
      kind: "review_profile",
      label: "Revisar perfil fiscal",
      href: "/settings/fiscal",
    }
  }

  if (status === "waiting_on_documents") {
    return {
      kind: "collect_documents",
      label: "Completar documentación",
      href: "/tax/review",
    }
  }

  if (status === "needs_review") {
    return {
      kind: "resolve_blockers",
      label: "Resolver bloqueos",
      href: "/tax/review",
    }
  }

  if (status === "draft_ready") {
    return {
      kind: "complete_dossier",
      label: "Completar expediente",
      href,
    }
  }

  if (status === "ready_to_file") {
    return {
      kind: "prepare_filing",
      label: "Preparar presentación",
      href,
    }
  }

  if (status === "filed") {
    return {
      kind: "view_dossier",
      label: "Ver expediente",
      href,
    }
  }

  if (status === "archived") {
    return {
      kind: "open_archive",
      label: "Abrir archivo",
      href: `/tax/archive/${periodKey}`,
    }
  }

  return {
    kind: "open_obligation",
    label: "Abrir obligación",
    href,
  }
}

function mapObligationStatus(status: string, blockingReasons: string[]) {
  if (status === "archived") return WORKFLOW_ITEM_STATUS.ARCHIVED
  if (status === "filed") return WORKFLOW_ITEM_STATUS.FILED
  if (status === "ready_to_file") return WORKFLOW_ITEM_STATUS.READY
  if (status === "needs_review" && blockingReasons.length > 0) return WORKFLOW_ITEM_STATUS.BLOCKED
  return WORKFLOW_ITEM_STATUS.NEEDS_ACTION
}

function mapObligationMateriality(status: string) {
  if (status === "ready_to_file" || status === "filed") {
    return WORKFLOW_MATERIALITY.HIGH
  }

  if (status === "needs_review") {
    return WORKFLOW_MATERIALITY.HIGH
  }

  return WORKFLOW_MATERIALITY.MEDIUM
}

export function buildFiscalWorkflowItems(input: Input): WorkflowItem[] {
  const items: WorkflowItem[] = []

  for (const obligation of input.obligations) {
    if (obligation.status === "not_applicable") {
      continue
    }

    const blockingReasons = normalizeBlockingReasons(obligation.blockingReasons)
    const href = buildObligationHref(obligation.code, obligation.periodKey)

    items.push({
      id: `obligation:${obligation.id}`,
      title: `Modelo ${normalizeWorkflowObligationCode(obligation.code)}`,
      description: `Obligación ${normalizeWorkflowObligationCode(obligation.code)} del periodo ${obligation.periodKey}.`,
      href,
      count: 1,
      status: mapObligationStatus(obligation.status, blockingReasons),
      source: WORKFLOW_ITEM_SOURCE.FISCAL,
      recommendedSurface: WORKFLOW_SURFACE.TAX,
      materiality: mapObligationMateriality(obligation.status),
      confidence: WORKFLOW_CONFIDENCE.CONFIRMED,
      owner: obligation.owner,
      dueAt: obligation.dueDate ? new Date(obligation.dueDate).toISOString() : null,
      nextAction: buildFiscalNextAction(obligation.status, obligation.code, obligation.periodKey),
      blockingReason: blockingReasons[0] ?? null,
      requiresDesktop: false,
    })

    const dossier = input.dossiersByObligationId?.[obligation.id]
    if (obligation.status === "filed" && dossier && !dossier.filingReceiptFileId) {
      items.push({
        id: `dossier:${obligation.id}:missing_receipt`,
        title: `Falta justificante del modelo ${normalizeWorkflowObligationCode(obligation.code)}`,
        description: `La obligación ${normalizeWorkflowObligationCode(obligation.code)} figura como presentada, pero el expediente aún no tiene justificante.`,
        href,
        count: 1,
        status: WORKFLOW_ITEM_STATUS.BLOCKED,
        source: WORKFLOW_ITEM_SOURCE.ARCHIVE,
        recommendedSurface: WORKFLOW_SURFACE.ARCHIVE,
        materiality: WORKFLOW_MATERIALITY.HIGH,
        confidence: WORKFLOW_CONFIDENCE.CONFIRMED,
        owner: obligation.owner,
        dueAt: obligation.dueDate ? new Date(obligation.dueDate).toISOString() : null,
        nextAction: {
          kind: "attach_receipt",
          label: "Adjuntar justificante",
          href,
        },
        blockingReason: "missing_receipt",
        requiresDesktop: false,
      })
    }
  }

  return items
}
