import { resolveFiscalReviewRequestAction } from "@/app/(app)/tax/review/actions"
import {
  getReviewReasonLabel,
} from "@/components/tax/quarters/quarterly-shared"
import { ReviewRequestComposer } from "@/components/tax/review/review-request-composer"
import { ReviewStatusBadge } from "@/components/tax/review/review-status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { MessageKey, Translator } from "@/lib/i18n"
import type { ReviewQueueItem } from "@/models/fiscal/review-queue"
import Link from "next/link"

function getDocumentKindLabel(documentKind: string, t: Translator): string {
  const messageKey: MessageKey =
    documentKind === "received_invoice"
      ? "tax.review.documentKind.received_invoice"
      : documentKind === "issued_invoice"
        ? "tax.review.documentKind.issued_invoice"
        : documentKind === "payroll_placeholder"
          ? "tax.review.documentKind.payroll_placeholder"
          : "tax.review.documentKind.unknown"

  return t(messageKey)
}

function getCounterpartyLabel(item: ReviewQueueItem, t: Translator): string {
  return item.counterparty_name ?? item.counterparty_tax_id ?? t("tax.review.counterparty.unknown")
}

function getOwnerLabel(owner: ReviewQueueItem["owner"]) {
  if (owner === "client") {
    return "Cliente"
  }

  if (owner === "shared") {
    return "Compartido"
  }

  return "Asesoría"
}

function getAffectedObligationLabel(code: ReviewQueueItem["affected_obligation_codes"][number]) {
  if (code === "111_manual") {
    return "111 manual"
  }

  return `Modelo ${code}`
}

function needsCounterpartyResolution(item: ReviewQueueItem) {
  return (
    item.review_reasons.includes("missing_counterparty_relation")
    || item.review_reasons.includes("missing_counterparty_tax_id")
  )
}

function getCounterpartyResolutionMatchLabel(matchReasons: string[], t: Translator) {
  if (matchReasons.includes("tax_id_exact")) {
    return t("tax.review.counterpartyResolution.match.taxIdExact")
  }

  if (matchReasons.includes("name_exact")) {
    return t("tax.review.counterpartyResolution.match.nameExact")
  }

  return t("tax.review.counterpartyResolution.match.suggested")
}

function getCounterpartyResolutionConflictLabel(
  conflictReason: string | null,
  t: Translator
) {
  const messageKey: Record<string, MessageKey> = {
    document_counterparty_id_conflict: "tax.review.counterpartyResolution.conflict.document_counterparty_id_conflict",
    multiple_name_candidates: "tax.review.counterpartyResolution.conflict.multiple_name_candidates",
    multiple_tax_id_candidates: "tax.review.counterpartyResolution.conflict.multiple_tax_id_candidates",
    no_identity_signal: "tax.review.counterpartyResolution.conflict.no_identity_signal",
    no_name_match: "tax.review.counterpartyResolution.conflict.no_name_match",
    no_tax_id_match: "tax.review.counterpartyResolution.conflict.no_tax_id_match",
    name_match_inactive_only: "tax.review.counterpartyResolution.conflict.name_match_inactive_only",
    tax_id_match_inactive_only: "tax.review.counterpartyResolution.conflict.tax_id_match_inactive_only",
  }

  if (!conflictReason || !messageKey[conflictReason]) {
    return t("tax.review.counterpartyResolution.noSafeCandidate")
  }

  return t(messageKey[conflictReason])
}

function getPendingActionLabel(item: ReviewQueueItem, t: Translator) {
  if (item.review_reasons.includes("missing_counterparty_tax_id")) {
    return t("tax.review.pendingAction.missingCounterpartyTaxId")
  }

  if (item.review_reasons.includes("missing_counterparty_relation")) {
    return t("tax.review.pendingAction.missingCounterpartyRelation")
  }

  return t("tax.review.pendingAction.default")
}

export function ReviewQueueList({ items, t }: { items: ReviewQueueItem[]; t: Translator }) {
  if (items.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{t("tax.review.empty.title")}</CardTitle>
          <CardDescription>{t("tax.review.empty.description")}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <section className="space-y-4" aria-label={t("tax.review.queue.sectionLabel")}>
      {items.map((item) => {
        const counterpartyResolutionRequired = needsCounterpartyResolution(item)
        const openLabel = counterpartyResolutionRequired
          ? t("tax.review.openResolution")
          : t("tax.review.openSource")

        return (
        <Card key={item.fiscal_document_id} className="shadow-sm">
          <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <ReviewStatusBadge status={item.review_status} t={t} />
                <span className="rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground">
                  {getDocumentKindLabel(item.document_kind, t)}
                </span>
                <span className="rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground">
                  {item.quarter?.period_key ?? t("tax.review.quarter.missing")}
                </span>
                <span className="rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground">
                  Tiene la pelota: {getOwnerLabel(item.owner)}
                </span>
              </div>
              <div className="space-y-1">
                <CardTitle className="text-lg">{getCounterpartyLabel(item, t)}</CardTitle>
                <CardDescription>
                  {t("tax.review.issueDate")}: {item.issue_date}
                </CardDescription>
              </div>
            </div>

            <Button asChild variant="outline" className="w-full md:w-auto">
              <Link href={item.drilldown_href}>{openLabel}</Link>
            </Button>
          </CardHeader>

          <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("tax.review.fields.document")}
                </dt>
                <dd className="mt-1 text-sm">{getDocumentKindLabel(item.document_kind, t)}</dd>
              </div>

              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("tax.review.fields.counterparty")}
                </dt>
                <dd className="mt-1 text-sm">{getCounterpartyLabel(item, t)}</dd>
              </div>

              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("tax.review.fields.taxId")}
                </dt>
                <dd className="mt-1 text-sm">
                  {item.counterparty_tax_id ?? t("tax.review.counterparty.taxIdMissing")}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("tax.review.fields.quarter")}
                </dt>
                <dd className="mt-1 text-sm">{item.quarter?.period_key ?? t("tax.review.quarter.missing")}</dd>
              </div>

              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("tax.review.fields.sourceTransaction")}
                </dt>
                <dd className="mt-1 break-all font-mono text-sm">{item.source_transaction_id}</dd>
              </div>

              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("tax.review.fields.fiscalDocument")}
                </dt>
                <dd className="mt-1 break-all font-mono text-sm">{item.fiscal_document_id}</dd>
              </div>
            </dl>

            <div className="space-y-3">
              <h2 className="text-sm font-semibold">{t("tax.review.reasons.title")}</h2>
              <div className="flex flex-wrap gap-2">
                {item.review_reasons.map((reason) => (
                  <span
                    key={`${item.fiscal_document_id}-${reason}`}
                    className="rounded-md border bg-muted/30 px-2.5 py-1 text-xs font-medium"
                  >
                    {getReviewReasonLabel(reason, t)}
                  </span>
                ))}
              </div>
              {item.affected_obligation_codes.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Obligaciones afectadas
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {item.affected_obligation_codes.map((code) => (
                      <span
                        key={`${item.fiscal_document_id}-${code}`}
                        className="rounded-md border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground"
                      >
                        {getAffectedObligationLabel(code)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("tax.review.pendingAction.title")}
                  </p>
                  <p className="text-sm font-medium">{getPendingActionLabel(item, t)}</p>
                </div>
                {item.counterparty_resolution ? (
                  <div className="space-y-1 rounded-md border bg-background p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("tax.review.counterpartyResolution.title")}
                    </p>
                    {(() => {
                      const showSuggestedCandidate = Boolean(
                        item.counterparty_resolution?.suggested_candidate
                        && item.counterparty_resolution.decision !== "needs_review_no_safe_candidate"
                        && !item.counterparty_resolution.conflict_reason
                      )

                      return (
                        <>
                          <p className="text-sm font-medium">
                            {showSuggestedCandidate
                              ? item.counterparty_resolution.suggested_candidate?.display_name
                              : t("tax.review.counterpartyResolution.noSafeCandidate")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {showSuggestedCandidate
                              ? [
                                  item.counterparty_resolution.suggested_candidate?.tax_id,
                                  getCounterpartyResolutionMatchLabel(
                                    item.counterparty_resolution.suggested_candidate?.match_reasons ?? [],
                                    t
                                  ),
                                ]
                                  .filter(Boolean)
                                  .join(" · ")
                              : getCounterpartyResolutionConflictLabel(
                                  item.counterparty_resolution.conflict_reason,
                                  t
                                )}
                          </p>
                        </>
                      )
                    })()}
                  </div>
                ) : null}
                <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
                  <Link href={item.drilldown_href}>
                    {needsCounterpartyResolution(item)
                      ? t("tax.review.openResolution")
                      : t("tax.review.openSource")}
                  </Link>
                </Button>
              </div>
              {item.active_request_count > 0 ? (
                <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                  <p className="text-sm font-semibold">
                    Incidencias abiertas: {item.active_request_count}
                  </p>
                  {item.active_requests.map((request) => (
                    <div key={request.id} className="rounded-md border bg-background p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground">
                          Responsable: {getOwnerLabel(request.owner)}
                        </span>
                        {request.due_date ? (
                          <span className="rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground">
                            Vence {request.due_date}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2">{request.message}</p>
                      <form action={resolveFiscalReviewRequestAction} className="mt-3">
                        <input type="hidden" name="requestId" value={request.id} />
                        <Button type="submit" size="sm" variant="outline">
                          Marcar como resuelta
                        </Button>
                      </form>
                    </div>
                  ))}
                </div>
              ) : null}
              <ReviewRequestComposer fiscalDocumentId={item.fiscal_document_id} />
              <p className="text-xs text-muted-foreground">
                {needsCounterpartyResolution(item)
                  ? t("tax.review.openResolutionHint")
                  : t("tax.review.openSourceHint")}
              </p>
            </div>
          </CardContent>
        </Card>
        )
      })}
    </section>
  )
}
