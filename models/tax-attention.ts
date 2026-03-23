import { getFiscalReviewQueue, type FiscalReviewQueue } from "./fiscal/review-queue.ts"
import { listQuarterlyDrafts, type QuarterlyDraft } from "./fiscal/quarterly-draft.ts"

export type TaxAttentionActionKind =
  | "review_blocked"
  | "review_queue"
  | "open_active_quarter"
  | "open_quarters"

export type TaxAttentionAction = {
  kind: TaxAttentionActionKind
  href: string
  moduleId: "review" | "quarters"
}

export type TaxAttention = {
  activeQuarter: {
    href: string
    periodKey: string
    status: QuarterlyDraft["operationalStatus"]["code"]
  } | null
  summary: {
    blockedDocuments: number
    needsReviewDocuments: number
  }
  nextAction: TaxAttentionAction
}

type TaxAttentionDependencies = {
  getFiscalReviewQueue?: typeof getFiscalReviewQueue
  listQuarterlyDrafts?: typeof listQuarterlyDrafts
}

function trimToNull(value?: string | null): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function isActiveQuarterCandidate(draft: QuarterlyDraft) {
  return draft.operationalStatus.code !== "closed" && draft.operationalStatus.code !== "presented"
}

function pickActiveQuarter(drafts: QuarterlyDraft[]) {
  return drafts.find(isActiveQuarterCandidate) ?? drafts[0] ?? null
}

function resolveNextAction(
  activeQuarter: QuarterlyDraft | null,
  queue: FiscalReviewQueue
): TaxAttentionAction {
  if (queue.summary.blocked > 0) {
    return {
      kind: "review_blocked",
      href: "/tax/review",
      moduleId: "review",
    }
  }

  if (queue.summary.needs_review > 0) {
    return {
      kind: "review_queue",
      href: "/tax/review",
      moduleId: "review",
    }
  }

  if (activeQuarter) {
    return {
      kind: "open_active_quarter",
      href: activeQuarter.periodHref,
      moduleId: "quarters",
    }
  }

  return {
    kind: "open_quarters",
    href: "/tax/quarters",
    moduleId: "quarters",
  }
}

export function buildTaxAttention({
  drafts,
  queue,
}: {
  drafts: QuarterlyDraft[]
  queue: FiscalReviewQueue
}): TaxAttention {
  const activeQuarter = pickActiveQuarter(drafts)

  return {
    activeQuarter: activeQuarter
      ? {
          periodKey: activeQuarter.period.periodKey,
          href: activeQuarter.periodHref,
          status: activeQuarter.operationalStatus.code,
        }
      : null,
    summary: {
      blockedDocuments: queue.summary.blocked,
      needsReviewDocuments: queue.summary.needs_review,
    },
    nextAction: resolveNextAction(activeQuarter, queue),
  }
}

export async function getTaxAttention(
  ownerScopeId: string,
  dependencies: TaxAttentionDependencies = {}
): Promise<TaxAttention> {
  const normalizedOwnerScopeId = trimToNull(ownerScopeId)

  if (!normalizedOwnerScopeId) {
    throw new Error("ownerScopeId es obligatorio para cargar la atención fiscal")
  }

  const loadQueue = dependencies.getFiscalReviewQueue ?? getFiscalReviewQueue
  const loadDrafts = dependencies.listQuarterlyDrafts ?? listQuarterlyDrafts
  const [queue, drafts] = await Promise.all([
    loadQueue(normalizedOwnerScopeId),
    loadDrafts(normalizedOwnerScopeId),
  ])

  return buildTaxAttention({
    drafts,
    queue,
  })
}
