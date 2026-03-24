import type { ReadinessSummary } from "./readiness"

export const ATTENTION_PRIORITY = {
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
} as const

export type AttentionPriority = (typeof ATTENTION_PRIORITY)[keyof typeof ATTENTION_PRIORITY]

export type AttentionSurface = "dashboard" | "settings" | "unsorted" | "transactions" | "tax" | "capture"

export type AttentionItem = {
  id: string
  title: string
  description: string
  nextActionLabel: string
  href: string
  count: number
  state: "blocked" | "needs_action"
  priority: AttentionPriority
  recommendedSurface: AttentionSurface
}

export type AttentionSummary = {
  readiness: ReadinessSummary
  items: AttentionItem[]
  topItem: AttentionItem | null
  counts: {
    unsorted: number
    deferredToDesktop: number
    fiscalBlocked: number
    fiscalNeedsReview: number
    transactionExceptions: number
  }
}

export type AttentionSignals = {
  readiness: ReadinessSummary
  unsortedCount: number
  deferredToDesktopCount: number
  transactionExceptionCount: number
  fiscalBlockedCount: number
  fiscalNeedsReviewCount: number
  activeQuarterLabel: string | null
}

function priorityWeight(priority: AttentionPriority) {
  if (priority === ATTENTION_PRIORITY.CRITICAL) return 0
  if (priority === ATTENTION_PRIORITY.HIGH) return 1
  if (priority === ATTENTION_PRIORITY.MEDIUM) return 2
  return 3
}

function sortAttentionItems(left: AttentionItem, right: AttentionItem) {
  const leftSetup = left.id.startsWith("setup_") && left.state === "blocked" ? 0 : 1
  const rightSetup = right.id.startsWith("setup_") && right.state === "blocked" ? 0 : 1

  if (leftSetup !== rightSetup) {
    return leftSetup - rightSetup
  }

  const priorityDelta = priorityWeight(left.priority) - priorityWeight(right.priority)
  if (priorityDelta !== 0) {
    return priorityDelta
  }

  if (left.count !== right.count) {
    return right.count - left.count
  }

  return left.title.localeCompare(right.title)
}

function buildSetupItems(readiness: ReadinessSummary): AttentionItem[] {
  return readiness.steps
    .filter((step) => !step.complete)
    .map((step) => ({
      id: `setup_${step.key}`,
      title: step.title,
      description: step.description,
      nextActionLabel: step.actionLabel,
      href: step.href,
      count: 1,
      state: step.blocking ? "blocked" : "needs_action",
      priority: step.blocking ? ATTENTION_PRIORITY.CRITICAL : ATTENTION_PRIORITY.MEDIUM,
      recommendedSurface: "settings" as const,
    }))
}

export function buildAttentionSummary(input: AttentionSignals): AttentionSummary {
  const items = buildSetupItems(input.readiness)

  if (input.fiscalBlockedCount > 0) {
    items.push({
      id: "tax_blocked",
      title: "Hay bloqueos fiscales que resolver",
      description:
        input.activeQuarterLabel
          ? `El trimestre ${input.activeQuarterLabel} tiene documentos bloqueados antes del cierre.`
          : "Hay documentos fiscales bloqueados antes del cierre.",
      nextActionLabel: "Revisar fiscal",
      href: "/tax",
      count: input.fiscalBlockedCount,
      state: "blocked",
      priority: ATTENTION_PRIORITY.CRITICAL,
      recommendedSurface: "tax",
    })
  }

  if (input.unsortedCount > 0) {
    items.push({
      id: "unsorted_review",
      title: "Hay documentos por revisar",
      description: "La bandeja de entrada operativa sigue estando en Unsorted.",
      nextActionLabel: "Abrir inbox",
      href: "/unsorted",
      count: input.unsortedCount,
      state: "needs_action",
      priority: ATTENTION_PRIORITY.HIGH,
      recommendedSurface: "unsorted",
    })
  }

  if (input.deferredToDesktopCount > 0) {
    items.push({
      id: "mobile_handoff",
      title: "Hay revisiones derivadas desde móvil",
      description: "Algunos documentos necesitan completar la revisión desde escritorio.",
      nextActionLabel: "Seguir en escritorio",
      href: "/unsorted",
      count: input.deferredToDesktopCount,
      state: "needs_action",
      priority: ATTENTION_PRIORITY.HIGH,
      recommendedSurface: "unsorted",
    })
  }

  if (input.transactionExceptionCount > 0) {
    items.push({
      id: "transaction_exceptions",
      title: "Hay registros con excepciones",
      description: "El libro operativo tiene transacciones incompletas o listas para corrección.",
      nextActionLabel: "Revisar libro",
      href: "/transactions?quickView=incomplete",
      count: input.transactionExceptionCount,
      state: "needs_action",
      priority: ATTENTION_PRIORITY.MEDIUM,
      recommendedSurface: "transactions",
    })
  }

  if (input.fiscalNeedsReviewCount > 0) {
    items.push({
      id: "tax_review",
      title: "Hay documentos fiscales pendientes de revisión",
      description: "Todavía quedan hechos fiscales en revisión antes del cierre.",
      nextActionLabel: "Abrir cola fiscal",
      href: "/tax/review",
      count: input.fiscalNeedsReviewCount,
      state: "needs_action",
      priority: ATTENTION_PRIORITY.MEDIUM,
      recommendedSurface: "tax",
    })
  }

  const sortedItems = items.sort(sortAttentionItems)

  return {
    readiness: input.readiness,
    items: sortedItems,
    topItem: sortedItems[0] ?? null,
    counts: {
      unsorted: input.unsortedCount,
      deferredToDesktop: input.deferredToDesktopCount,
      fiscalBlocked: input.fiscalBlockedCount,
      fiscalNeedsReview: input.fiscalNeedsReviewCount,
      transactionExceptions: input.transactionExceptionCount,
    },
  }
}
