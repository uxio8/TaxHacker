import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Translator } from "@/lib/i18n"
import type { QuarterlyDraft } from "@/models/fiscal/quarterly-draft"
import Link from "next/link"
import {
  formatFiscalDate,
  formatFiscalMoney,
  formatFiscalNumber,
  getDocumentCounterpartyLabel,
  getPeriodStatusLabel,
  getReviewReasonLabel,
  QuarterlyEmptyState,
  QuarterlyMetricCard,
  QuarterlyOperationalStatusBadge,
  QuarterlyReviewStatusBadge,
  sortQuarterlyDocuments,
} from "./quarterly-shared"

export function QuarterlyDetail({
  draft,
  profileName,
  profileTaxId,
  t,
}: {
  draft: QuarterlyDraft
  profileName: string
  profileTaxId: string
  t: Translator
}) {
  const documents = sortQuarterlyDocuments(draft.documents)

  return (
    <section className="flex flex-col gap-6">
      <div>
        <Button asChild variant="ghost" className="px-0">
          <Link href="/tax/quarters">{t("tax.quarters.actions.backToList")}</Link>
        </Button>
      </div>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <Card className="shadow-sm">
          <CardHeader className="gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <QuarterlyOperationalStatusBadge code={draft.operationalStatus.code} t={t} />
              <span className="rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground">
                {getPeriodStatusLabel(draft.period.status, t)}
              </span>
            </div>
            <div className="space-y-2">
              <CardTitle className="text-3xl tracking-tight">
                {t("tax.quarters.detail.title", { period: draft.period.periodKey })}
              </CardTitle>
              <CardDescription className="max-w-3xl text-sm sm:text-base">
                {t("tax.quarters.detail.description")}
              </CardDescription>
            </div>
            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <p>
                {t("tax.quarters.detail.window")} {draft.period.startsOn} - {draft.period.endsOn}
              </p>
              <p>{t("tax.quarters.detail.profile", { company: profileName })}</p>
            </div>
          </CardHeader>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>{t("tax.quarters.profile.title")}</CardTitle>
            <CardDescription>{t("tax.quarters.detail.profileDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-medium">{profileName}</p>
              <p className="text-muted-foreground">{profileTaxId}</p>
            </div>
            <div className="grid gap-2 text-muted-foreground">
              <p>
                {t("tax.quarters.detail.model303")}{" "}
                <span className="font-medium text-foreground">
                  {formatFiscalNumber(draft.totals.model303DocumentCount)}
                </span>
              </p>
              <p>
                {t("tax.quarters.detail.model115")}{" "}
                <span className="font-medium text-foreground">
                  {formatFiscalNumber(draft.totals.model115DocumentCount)}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <QuarterlyMetricCard
          description={t("tax.quarters.fields.documents")}
          value={formatFiscalNumber(draft.totals.documentCount)}
        />
        <QuarterlyMetricCard
          description={t("tax.quarters.fields.ready")}
          value={formatFiscalNumber(draft.operationalStatus.readyDocumentCount)}
        />
        <QuarterlyMetricCard
          description={t("tax.quarters.fields.review")}
          value={formatFiscalNumber(draft.operationalStatus.reviewDocumentCount)}
        />
        <QuarterlyMetricCard
          description={t("tax.quarters.fields.blocked")}
          value={formatFiscalNumber(draft.operationalStatus.blockingDocumentCount)}
        />
        <QuarterlyMetricCard
          description={t("tax.quarters.fields.net")}
          value={formatFiscalMoney(draft.totals.totalNetCents, draft.period.currencyCode)}
        />
        <QuarterlyMetricCard
          description={t("tax.quarters.fields.vat")}
          value={formatFiscalMoney(draft.totals.totalVatCents, draft.period.currencyCode)}
        />
        <QuarterlyMetricCard
          description={t("tax.quarters.fields.withholding")}
          value={formatFiscalMoney(draft.totals.totalWithholdingCents, draft.period.currencyCode)}
        />
        <QuarterlyMetricCard
          description={t("tax.quarters.fields.payable")}
          value={formatFiscalMoney(draft.totals.totalPayableCents, draft.period.currencyCode)}
        />
      </section>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{t("tax.quarters.detail.documents.title")}</CardTitle>
          <CardDescription>{t("tax.quarters.detail.documents.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <QuarterlyEmptyState
              title={t("tax.quarters.detail.documents.empty.title")}
              description={t("tax.quarters.detail.documents.empty.description")}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("tax.quarters.fields.issueDate")}</TableHead>
                  <TableHead>{t("tax.quarters.fields.invoice")}</TableHead>
                  <TableHead>{t("tax.quarters.fields.counterparty")}</TableHead>
                  <TableHead>{t("tax.quarters.fields.reviewStatus")}</TableHead>
                  <TableHead>{t("tax.quarters.fields.coverage")}</TableHead>
                  <TableHead className="text-right">{t("tax.quarters.fields.net")}</TableHead>
                  <TableHead className="text-right">{t("tax.quarters.fields.vat")}</TableHead>
                  <TableHead className="text-right">{t("tax.quarters.fields.withholding")}</TableHead>
                  <TableHead className="text-right">{t("tax.quarters.fields.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((document) => (
                  <TableRow key={document.fiscalDocumentId}>
                    <TableCell>
                      {formatFiscalDate(document.issueDate, t("tax.quarters.date.missing"))}
                    </TableCell>
                    <TableCell>{document.invoiceNumber ?? t("tax.quarters.invoice.missing")}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{getDocumentCounterpartyLabel(document, t)}</p>
                        <p className="text-xs text-muted-foreground">
                          {document.counterpartyTaxId ?? t("tax.quarters.counterparty.taxIdMissing")}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <QuarterlyReviewStatusBadge status={document.reviewStatus} t={t} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {document.includesVat ? (
                          <span className="rounded-md border px-2 py-1 text-xs font-medium">
                            {t("tax.quarters.coverage.vat")}
                          </span>
                        ) : null}
                        {document.includesWithholding ? (
                          <span className="rounded-md border px-2 py-1 text-xs font-medium">
                            {t("tax.quarters.coverage.withholding")}
                          </span>
                        ) : null}
                        {!document.includesVat && !document.includesWithholding ? (
                          <span className="text-xs text-muted-foreground">
                            {t("tax.quarters.coverage.none")}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatFiscalMoney(document.totalNetCents, draft.period.currencyCode)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatFiscalMoney(document.totalVatCents, draft.period.currencyCode)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatFiscalMoney(document.totalWithholdingCents, draft.period.currencyCode)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={document.transactionHref}>
                            {t("tax.quarters.actions.openTransaction")}
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="ghost">
                          <Link href={document.factHref}>{t("tax.quarters.actions.openFact")}</Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">{t("tax.quarters.detail.facts.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("tax.quarters.detail.facts.description")}</p>
        </div>

        {documents.length === 0 ? (
          <QuarterlyEmptyState
            title={t("tax.quarters.detail.documents.empty.title")}
            description={t("tax.quarters.detail.documents.empty.description")}
          />
        ) : (
          documents.map((document) => (
            <Card
              key={`fact-${document.fiscalDocumentId}`}
              id={`fact-${document.fiscalDocumentId}`}
              className="scroll-mt-24 shadow-sm"
            >
              <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <QuarterlyReviewStatusBadge status={document.reviewStatus} t={t} />
                    <span className="rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground">
                      {document.fiscalDocumentId}
                    </span>
                    <span className="rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground">
                      {document.sourceTransactionId}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-lg">
                      {getDocumentCounterpartyLabel(document, t)}
                    </CardTitle>
                    <CardDescription>
                      {formatFiscalDate(document.issueDate, t("tax.quarters.date.missing"))}
                      {" · "}
                      {document.invoiceNumber ?? t("tax.quarters.invoice.missing")}
                    </CardDescription>
                  </div>
                </div>

                <Button asChild variant="outline" className="w-full md:w-auto">
                  <Link href={document.transactionHref}>{t("tax.quarters.actions.openTransaction")}</Link>
                </Button>
              </CardHeader>

              <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("tax.quarters.fields.counterparty")}
                    </dt>
                    <dd className="mt-1 text-sm">{getDocumentCounterpartyLabel(document, t)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("tax.quarters.fields.taxId")}
                    </dt>
                    <dd className="mt-1 text-sm">
                      {document.counterpartyTaxId ?? t("tax.quarters.counterparty.taxIdMissing")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("tax.quarters.fields.net")}
                    </dt>
                    <dd className="mt-1 text-sm">
                      {formatFiscalMoney(document.totalNetCents, draft.period.currencyCode)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("tax.quarters.fields.vat")}
                    </dt>
                    <dd className="mt-1 text-sm">
                      {formatFiscalMoney(document.totalVatCents, draft.period.currencyCode)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("tax.quarters.fields.withholding")}
                    </dt>
                    <dd className="mt-1 text-sm">
                      {formatFiscalMoney(document.totalWithholdingCents, draft.period.currencyCode)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("tax.quarters.fields.payable")}
                    </dt>
                    <dd className="mt-1 text-sm">
                      {formatFiscalMoney(document.totalPayableCents, draft.period.currencyCode)}
                    </dd>
                  </div>
                </dl>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">{t("tax.quarters.fields.reasons")}</h3>
                  {document.reviewReasons.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("tax.quarters.detail.reasons.empty")}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {document.reviewReasons.map((reason) => (
                        <span
                          key={`${document.fiscalDocumentId}-${reason}`}
                          className="rounded-md border bg-muted/30 px-2.5 py-1 text-xs font-medium"
                        >
                          {getReviewReasonLabel(reason, t)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </section>
  )
}
