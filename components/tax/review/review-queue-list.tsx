import { resolveFiscalReviewRequestAction } from "@/app/(app)/tax/review/actions"
import { ReviewRequestComposer } from "@/components/tax/review/review-request-composer"
import { ReviewStatusBadge } from "@/components/tax/review/review-status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { MessageKey, Translator } from "@/lib/i18n"
import type { ReviewQueueItem } from "@/models/fiscal/review-queue"
import type { ReviewReason } from "@/models/fiscal/review-status"
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

function getReviewReasonLabel(reason: ReviewReason, t: Translator): string {
  const messageKey: Record<ReviewReason, MessageKey> = {
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

  return t(messageKey[reason])
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
      {items.map((item) => (
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
              <Link href={item.drilldown_href}>{t("tax.review.openSource")}</Link>
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
                El panel fiscal está dentro del detalle de la transacción enlazada.
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  )
}
