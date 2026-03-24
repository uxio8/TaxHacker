import {
  REVIEW_STATUS_BLOCKED,
  REVIEW_STATUS_NEEDS_REVIEW,
  type FiscalPeriodAssignment,
  getAffectedObligationsForCounterpartyReviewGate,
  type ReviewReason,
} from "./review-status.ts"
import {
  buildCounterpartyResolutionDocumentInput,
  COUNTERPARTY_RESOLUTION_DECISION,
  mapCounterpartiesToResolutionInput,
  resolveCounterpartyResolution,
  type CounterpartyConflictReason,
  type CounterpartyMatchReason,
  type CounterpartyResolutionDecision,
} from "./counterparty-resolution.ts"
import {
  listOpenFiscalReviewRequestsByDocumentIds,
  type FiscalReviewRequest,
  type FiscalReviewRequestOwner,
} from "./review-requests.ts"
import { withFiscalStorageGuard } from "./storage.ts"

export const REVIEW_QUEUE_DRILLDOWN_BASE_PATH = "/transactions" as const

type ReviewQueueStatus = typeof REVIEW_STATUS_BLOCKED | typeof REVIEW_STATUS_NEEDS_REVIEW

type ReviewQueueRecord = {
  id: string
  ownerScopeId: string
  sourceTransactionId: string
  documentKind: string
  issueDate: Date
  counterpartyId: string | null
  counterpartyRole: string
  counterpartyName: string | null
  counterpartyTaxId: string | null
  counterpartyCountryCode: string | null
  totalPayableCents: number | null
  totalVatCents: number | null
  totalWithholdingCents: number | null
  reviewStatus: string
  reviewReasons: ReviewReason[]
  vatPeriodAssignment: FiscalPeriodAssignment | null
  withholdingPeriodAssignment: FiscalPeriodAssignment | null
}

export type ReviewQueueQuarter = Pick<
  FiscalPeriodAssignment,
  "basis" | "fiscal_year" | "period_key" | "quarter"
>

export type ReviewQueueCounterpartyResolutionSummary = {
  decision: CounterpartyResolutionDecision
  active_candidate_count: number
  conflict_reason: CounterpartyConflictReason | null
  suggested_candidate: {
    id: string
    display_name: string
    tax_id: string | null
    match_reasons: CounterpartyMatchReason[]
  } | null
}

export type ReviewQueueItem = {
  fiscal_document_id: string
  source_transaction_id: string
  document_kind: string
  issue_date: string
  counterparty_name: string | null
  counterparty_tax_id: string | null
  counterparty_country_code: string | null
  counterparty_role: string
  review_status: ReviewQueueStatus
  review_reasons: ReviewReason[]
  affected_obligation_codes: Array<"111_manual" | "115" | "180" | "347" | "349">
  quarter: ReviewQueueQuarter | null
  drilldown_href: string
  owner: FiscalReviewRequestOwner
  counterparty_resolution: ReviewQueueCounterpartyResolutionSummary | null
  active_request_count: number
  active_requests: Array<{
    id: string
    actor_type: FiscalReviewRequest["actorType"]
    owner: FiscalReviewRequestOwner
    message: string
    due_date: string | null
    status: FiscalReviewRequest["status"]
  }>
}

export type ReviewQueueSummary = {
  total: number
  blocked: number
  needs_review: number
}

export type FiscalReviewQueue = {
  summary: ReviewQueueSummary
  items: ReviewQueueItem[]
}

const REVIEW_QUEUE_SELECT = {
  id: true,
  ownerScopeId: true,
  sourceTransactionId: true,
  documentKind: true,
  issueDate: true,
  counterpartyId: true,
  counterpartyRole: true,
  counterpartyName: true,
  counterpartyTaxId: true,
  counterpartyCountryCode: true,
  totalPayableCents: true,
  totalVatCents: true,
  totalWithholdingCents: true,
  reviewStatus: true,
  reviewReasons: true,
  vatPeriodAssignment: true,
  withholdingPeriodAssignment: true,
} as const

type ReviewQueueStore = {
  transactionFiscal: {
    findMany(args: {
      where: {
        ownerScopeId: string
        reviewStatus: {
          in: ReviewQueueStatus[]
        }
      }
      select: typeof REVIEW_QUEUE_SELECT
    }): Promise<ReviewQueueRecord[]>
  }
  counterparty?: {
    findMany(args: {
      where: { ownerScopeId: string }
      orderBy: { displayName: "asc" | "desc" }
    }): Promise<
      Array<{
        id: string
        ownerScopeId: string
        displayName: string
        normalizedName: string
        taxId: string | null
        taxIdNormalized: string
        canonicalIdentityKey: string
        isActive: boolean
      }>
    >
  }
  fiscalReviewRequest?: {
    findMany: (args: {
      where: {
        ownerScopeId: string
        status: "open"
        fiscalDocumentId: {
          in: string[]
        }
      }
      orderBy: Array<Record<string, "asc" | "desc">>
    }) => Promise<
      Array<{
        id: string
        organizationId: string
        ownerScopeId: string
        fiscalDocumentId: string
        createdByUserId: string
        actorType: string
        owner: string
        message: string
        dueDate: Date | null
        status: string
        resolvedAt: Date | null
        resolvedByUserId: string | null
        createdAt: Date
        updatedAt: Date
      }>
    >
  }
}

function trimToNull(value?: string | null): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function serializeDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function isReviewQueueStatus(value: string): value is ReviewQueueStatus {
  return value === REVIEW_STATUS_BLOCKED || value === REVIEW_STATUS_NEEDS_REVIEW
}

function isFiscalPeriodAssignment(value: unknown): value is FiscalPeriodAssignment {
  if (!value || typeof value !== "object") {
    return false
  }

  const candidate = value as Record<string, unknown>

  return (
    typeof candidate.fiscal_year === "number" &&
    typeof candidate.quarter === "number" &&
    typeof candidate.period_key === "string" &&
    typeof candidate.basis === "string" &&
    typeof candidate.assigned_at === "string"
  )
}

function pickQuarter(record: ReviewQueueRecord): ReviewQueueQuarter | null {
  const assignment = isFiscalPeriodAssignment(record.vatPeriodAssignment)
    ? record.vatPeriodAssignment
    : isFiscalPeriodAssignment(record.withholdingPeriodAssignment)
      ? record.withholdingPeriodAssignment
      : null

  if (!assignment) {
    return null
  }

  return {
    fiscal_year: assignment.fiscal_year,
    quarter: assignment.quarter,
    period_key: assignment.period_key,
    basis: assignment.basis,
  }
}

function toReviewQueueItem(
  record: ReviewQueueRecord,
  activeRequests: FiscalReviewRequest[] = [],
  counterpartyResolution: ReviewQueueCounterpartyResolutionSummary | null = null
): ReviewQueueItem {
  const reviewStatus = isReviewQueueStatus(record.reviewStatus)
    ? record.reviewStatus
    : REVIEW_STATUS_NEEDS_REVIEW
  const owner = activeRequests[0]?.owner ?? "advisor"

  return {
    fiscal_document_id: record.id,
    source_transaction_id: record.sourceTransactionId,
    document_kind: record.documentKind,
    issue_date: serializeDateOnly(record.issueDate),
    counterparty_name: record.counterpartyName,
    counterparty_tax_id: record.counterpartyTaxId,
    counterparty_country_code: trimToNull(record.counterpartyCountryCode),
    counterparty_role: record.counterpartyRole,
    review_status: reviewStatus,
    review_reasons: Array.isArray(record.reviewReasons) ? record.reviewReasons : [],
    affected_obligation_codes: getAffectedObligationsForCounterpartyReviewGate({
      reviewReasons: Array.isArray(record.reviewReasons) ? record.reviewReasons : [],
      counterpartyRole: record.counterpartyRole,
      counterpartyCountryCode: record.counterpartyCountryCode,
    }),
    quarter: pickQuarter(record),
    drilldown_href: `${REVIEW_QUEUE_DRILLDOWN_BASE_PATH}/${record.sourceTransactionId}`,
    owner,
    counterparty_resolution: counterpartyResolution,
    active_request_count: activeRequests.length,
    active_requests: activeRequests.map((request) => ({
      id: request.id,
      actor_type: request.actorType,
      owner: request.owner,
      message: request.message,
      due_date: request.dueDate,
      status: request.status,
    })),
  }
}

function compareReviewQueueItems(left: ReviewQueueItem, right: ReviewQueueItem): number {
  const leftPriority = left.review_status === REVIEW_STATUS_BLOCKED ? 0 : 1
  const rightPriority = right.review_status === REVIEW_STATUS_BLOCKED ? 0 : 1

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority
  }

  if (left.issue_date !== right.issue_date) {
    return left.issue_date.localeCompare(right.issue_date)
  }

  return left.fiscal_document_id.localeCompare(right.fiscal_document_id)
}

async function listOpenRequests(
  ownerScopeId: string,
  fiscalDocumentIds: string[],
  store?: ReviewQueueStore
) {
  const reviewRequestStore = store?.fiscalReviewRequest
    ?? ((await import("../../lib/db.ts")).prisma as unknown as {
      fiscalReviewRequest: NonNullable<ReviewQueueStore["fiscalReviewRequest"]>
    }).fiscalReviewRequest

  return listOpenFiscalReviewRequestsByDocumentIds(ownerScopeId, fiscalDocumentIds, {
    fiscalReviewRequest: {
      create: async () => {
        throw new Error("create no disponible en ReviewQueueStore")
      },
      update: async () => {
        throw new Error("update no disponible en ReviewQueueStore")
      },
      findMany: reviewRequestStore.findMany.bind(reviewRequestStore),
    },
  })
}

async function listCounterparties(
  ownerScopeId: string,
  store?: ReviewQueueStore
) {
  const counterpartyStore = store?.counterparty
    ?? ((await import("../../lib/db.ts")).prisma as unknown as {
      counterparty: NonNullable<ReviewQueueStore["counterparty"]>
    }).counterparty

  return counterpartyStore.findMany({
    where: { ownerScopeId },
    orderBy: { displayName: "asc" },
  })
}

function buildCounterpartyResolutionSummary(
  record: ReviewQueueRecord,
  counterparties: Awaited<ReturnType<typeof listCounterparties>>
): ReviewQueueCounterpartyResolutionSummary | null {
  if (!record.reviewReasons.includes("missing_counterparty_relation")) {
    return null
  }

  const resolution = resolveCounterpartyResolution({
    ownerScopeId: record.ownerScopeId,
    document: buildCounterpartyResolutionDocumentInput({
      fiscal_document_id: record.id,
      source_transaction_id: record.sourceTransactionId,
      document_kind: record.documentKind,
      counterparty_id: record.counterpartyId,
      counterparty_name: record.counterpartyName,
      counterparty_tax_id: record.counterpartyTaxId,
      counterparty_role: record.counterpartyRole,
      issue_date: serializeDateOnly(record.issueDate),
      total_payable_cents: record.totalPayableCents,
      total_vat_cents: record.totalVatCents,
      total_withholding_cents: record.totalWithholdingCents,
    }),
    counterparties: mapCounterpartiesToResolutionInput(counterparties),
  })

  const suggestedCandidate =
    resolution.decision === COUNTERPARTY_RESOLUTION_DECISION.NEEDS_REVIEW_NO_SAFE_CANDIDATE
      ? null
      : resolution.relevant_candidates.find((candidate) => candidate.is_active) ?? null

  return {
    decision: resolution.decision,
    active_candidate_count: resolution.evidence.active_candidate_count,
    conflict_reason: resolution.evidence.conflict_reason,
    suggested_candidate: suggestedCandidate
      ? {
          id: suggestedCandidate.id,
          display_name: suggestedCandidate.display_name,
          tax_id: suggestedCandidate.tax_id,
          match_reasons: suggestedCandidate.match_reasons,
        }
      : null,
  }
}

async function resolveStore(store?: ReviewQueueStore): Promise<ReviewQueueStore> {
  if (store) {
    return store
  }

  const { prisma } = await import("../../lib/db.ts")
  return prisma as unknown as ReviewQueueStore
}

export async function getFiscalReviewQueue(
  ownerScopeId: string,
  store?: ReviewQueueStore
): Promise<FiscalReviewQueue> {
  return withFiscalStorageGuard(async () => {
    const normalizedOwnerScopeId = trimToNull(ownerScopeId)

    if (!normalizedOwnerScopeId) {
      throw new Error("ownerScopeId es obligatorio para obtener la cola fiscal")
    }

    const db = await resolveStore(store)
    const records = await db.transactionFiscal.findMany({
      where: {
        ownerScopeId: normalizedOwnerScopeId,
        reviewStatus: {
          in: [REVIEW_STATUS_NEEDS_REVIEW, REVIEW_STATUS_BLOCKED],
        },
      },
      select: REVIEW_QUEUE_SELECT,
    })
    const needsCounterpartyResolution = records.some(
      (record) =>
        Array.isArray(record.reviewReasons)
        && record.reviewReasons.includes("missing_counterparty_relation")
    )
    const fiscalDocumentIds = records.map((record) => record.id)
    const requestsByDocumentId = new Map<string, FiscalReviewRequest[]>()
    const openRequests = await listOpenRequests(normalizedOwnerScopeId, fiscalDocumentIds, store)
    const counterparties = needsCounterpartyResolution
      ? await listCounterparties(normalizedOwnerScopeId, store)
      : []

    for (const request of openRequests) {
      const requests = requestsByDocumentId.get(request.fiscalDocumentId) ?? []
      requests.push(request)
      requestsByDocumentId.set(request.fiscalDocumentId, requests)
    }

    const items = records
      .filter((record) => isReviewQueueStatus(record.reviewStatus))
      .map((record) =>
        toReviewQueueItem(
          record,
          requestsByDocumentId.get(record.id) ?? [],
          buildCounterpartyResolutionSummary(record, counterparties)
        )
      )
      .sort(compareReviewQueueItems)

    return {
      summary: {
        total: items.length,
        blocked: items.filter((item) => item.review_status === REVIEW_STATUS_BLOCKED).length,
        needs_review: items.filter((item) => item.review_status === REVIEW_STATUS_NEEDS_REVIEW).length,
      },
      items,
    }
  })
}
