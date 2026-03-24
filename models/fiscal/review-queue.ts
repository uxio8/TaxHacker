import {
  REVIEW_STATUS_BLOCKED,
  REVIEW_STATUS_NEEDS_REVIEW,
  type FiscalPeriodAssignment,
  getAffectedObligationsForCounterpartyReviewGate,
  type ReviewReason,
} from "./review-status.ts"
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
  counterpartyRole: string
  counterpartyName: string | null
  counterpartyTaxId: string | null
  counterpartyCountryCode: string | null
  reviewStatus: string
  reviewReasons: ReviewReason[]
  vatPeriodAssignment: FiscalPeriodAssignment | null
  withholdingPeriodAssignment: FiscalPeriodAssignment | null
}

export type ReviewQueueQuarter = Pick<
  FiscalPeriodAssignment,
  "basis" | "fiscal_year" | "period_key" | "quarter"
>

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
  counterpartyRole: true,
  counterpartyName: true,
  counterpartyTaxId: true,
  counterpartyCountryCode: true,
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
  activeRequests: FiscalReviewRequest[] = []
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
    const fiscalDocumentIds = records.map((record) => record.id)
    const requestsByDocumentId = new Map<string, FiscalReviewRequest[]>()
    const openRequests = await listOpenRequests(normalizedOwnerScopeId, fiscalDocumentIds, store)

    for (const request of openRequests) {
      const requests = requestsByDocumentId.get(request.fiscalDocumentId) ?? []
      requests.push(request)
      requestsByDocumentId.set(request.fiscalDocumentId, requests)
    }

    const items = records
      .filter((record) => isReviewQueueStatus(record.reviewStatus))
      .map((record) => toReviewQueueItem(record, requestsByDocumentId.get(record.id) ?? []))
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
