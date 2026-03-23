import { Badge } from "@/components/ui/badge"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { MessageKey, Translator } from "@/lib/i18n"
import type {
  QuarterlyDraft,
  QuarterlyDraftDocument,
  QuarterlyDraftOperationalStatusCode,
} from "@/models/fiscal/quarterly-draft"
import type { FiscalPeriodStatus } from "@/models/fiscal/periods"
import type { ReviewReason, ReviewStatus } from "@/models/fiscal/review-status"

const REVIEW_REASON_KEYS: Record<ReviewReason, MessageKey> = {
  missing_invoice_number: "tax.review.reason.missing_invoice_number",
  missing_counterparty_relation: "tax.review.reason.missing_counterparty_relation",
  missing_counterparty_tax_id: "tax.review.reason.missing_counterparty_tax_id",
  missing_vat_breakdown: "tax.review.reason.missing_vat_breakdown",
  mixed_tax_treatment_unresolved: "tax.review.reason.mixed_tax_treatment_unresolved",
  missing_rent_withholding: "tax.review.reason.missing_rent_withholding",
  employee_payroll_source_missing: "tax.review.reason.employee_payroll_source_missing",
  period_assignment_unclear: "tax.review.reason.period_assignment_unclear",
  manual_override_required: "tax.review.reason.manual_override_required",
  header_totals_mismatch: "tax.review.reason.header_totals_mismatch",
  invalid_currency_code: "tax.review.reason.invalid_currency_code",
  invalid_direction_document_kind_combo: "tax.review.reason.invalid_direction_document_kind_combo",
}

const REVIEW_STATUS_SORT_ORDER: Record<ReviewStatus, number> = {
  blocked: 0,
  needs_review: 1,
  pending: 2,
  ready: 3,
}

export function formatFiscalMoney(cents: number, currencyCode: string = "EUR") {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

export function formatFiscalNumber(value: number) {
  return new Intl.NumberFormat("es-ES").format(value)
}

export function formatFiscalDate(value: string | null, fallback: string) {
  if (!value) {
    return fallback
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`))
}

export function getOperationalStatusLabel(
  code: QuarterlyDraftOperationalStatusCode,
  t: Translator
) {
  const messageKey: Record<QuarterlyDraftOperationalStatusCode, MessageKey> = {
    open: "tax.quarters.status.operational.open",
    review_pending: "tax.quarters.status.operational.review_pending",
    review_blocked: "tax.quarters.status.operational.review_blocked",
    ready: "tax.quarters.status.operational.ready",
    presented: "tax.quarters.status.operational.presented",
    closed: "tax.quarters.status.operational.closed",
  }

  return t(messageKey[code])
}

export function getPeriodStatusLabel(status: FiscalPeriodStatus, t: Translator) {
  const messageKey: Record<FiscalPeriodStatus, MessageKey> = {
    open: "tax.quarters.status.period.open",
    in_review: "tax.quarters.status.period.in_review",
    ready: "tax.quarters.status.period.ready",
    presented: "tax.quarters.status.period.presented",
    closed: "tax.quarters.status.period.closed",
  }

  return t(messageKey[status])
}

export function getReviewStatusLabel(status: ReviewStatus, t: Translator) {
  const messageKey: Record<ReviewStatus, MessageKey> = {
    ready: "tax.quarters.status.review.ready",
    needs_review: "tax.quarters.status.review.needs_review",
    blocked: "tax.quarters.status.review.blocked",
    pending: "tax.quarters.status.review.pending",
  }

  return t(messageKey[status])
}

export function getReviewReasonLabel(reason: string, t: Translator) {
  const messageKey = REVIEW_REASON_KEYS[reason as ReviewReason]

  return messageKey ? t(messageKey) : reason
}

export function getDocumentCounterpartyLabel(document: QuarterlyDraftDocument, t: Translator) {
  return (
    document.counterpartyName ??
    document.counterpartyTaxId ??
    t("tax.quarters.counterparty.unknown")
  )
}

export function sortQuarterlyDocuments(documents: QuarterlyDraftDocument[]) {
  return [...documents].sort((left, right) => {
    const reviewStatusComparison =
      REVIEW_STATUS_SORT_ORDER[left.reviewStatus] - REVIEW_STATUS_SORT_ORDER[right.reviewStatus]

    if (reviewStatusComparison !== 0) {
      return reviewStatusComparison
    }

    const issueDateComparison = (right.issueDate ?? "").localeCompare(left.issueDate ?? "")

    if (issueDateComparison !== 0) {
      return issueDateComparison
    }

    return left.fiscalDocumentId.localeCompare(right.fiscalDocumentId)
  })
}

export function QuarterlyOperationalStatusBadge({
  code,
  t,
}: {
  code: QuarterlyDraftOperationalStatusCode
  t: Translator
}) {
  const variant =
    code === "review_blocked"
      ? "destructive"
      : code === "review_pending" || code === "open"
        ? "outline"
        : code === "ready"
          ? "default"
          : "secondary"

  return <Badge variant={variant}>{getOperationalStatusLabel(code, t)}</Badge>
}

export function QuarterlyReviewStatusBadge({
  status,
  t,
}: {
  status: ReviewStatus
  t: Translator
}) {
  const variant =
    status === "blocked"
      ? "destructive"
      : status === "ready"
        ? "default"
        : "outline"

  return <Badge variant={variant}>{getReviewStatusLabel(status, t)}</Badge>
}

export function QuarterlyMetricCard({
  description,
  value,
}: {
  description: string
  value: string
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="gap-1">
        <CardDescription>{description}</CardDescription>
        <CardTitle className="text-2xl tracking-tight">{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}

export function QuarterlyEmptyState({
  description,
  title,
}: {
  description: string
  title: string
}) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-6">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

export function buildQuarterSummary(drafts: QuarterlyDraft[]) {
  return drafts.reduce(
    (summary, draft) => {
      summary.periodCount += 1
      summary.documentCount += draft.totals.documentCount
      summary.reviewCount += draft.operationalStatus.reviewDocumentCount
      summary.blockingCount += draft.operationalStatus.blockingDocumentCount
      summary.model303Count += draft.totals.model303DocumentCount
      summary.model115Count += draft.totals.model115DocumentCount
      summary.totalPayableCents += draft.totals.totalPayableCents
      return summary
    },
    {
      periodCount: 0,
      documentCount: 0,
      reviewCount: 0,
      blockingCount: 0,
      model303Count: 0,
      model115Count: 0,
      totalPayableCents: 0,
    }
  )
}
