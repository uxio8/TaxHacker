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
  buildQuarterSummary,
  formatFiscalMoney,
  formatFiscalNumber,
  getPeriodStatusLabel,
  QuarterlyEmptyState,
  QuarterlyMetricCard,
  QuarterlyOperationalStatusBadge,
} from "./quarterly-shared"

export function QuarterlyOverview({
  drafts,
  profileName,
  profileTaxId,
  t,
}: {
  drafts: QuarterlyDraft[]
  profileName: string
  profileTaxId: string
  t: Translator
}) {
  const summary = buildQuarterSummary(drafts)

  return (
    <section className="flex flex-col gap-6">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <Card className="shadow-sm">
          <CardHeader className="gap-3">
            <div className="w-fit rounded-md border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("tax.quarters.eyebrow")}
            </div>
            <div className="space-y-2">
              <CardTitle className="text-3xl tracking-tight">{t("tax.quarters.title")}</CardTitle>
              <CardDescription className="max-w-2xl text-sm sm:text-base">
                {t("tax.quarters.description")}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>{t("tax.quarters.profile.title")}</CardTitle>
            <CardDescription>{t("tax.quarters.profile.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-medium">{profileName}</p>
              <p className="text-muted-foreground">{profileTaxId}</p>
            </div>
            <p className="text-muted-foreground">{t("tax.quarters.profile.scope")}</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <QuarterlyMetricCard
          description={t("tax.quarters.summary.periods")}
          value={formatFiscalNumber(summary.periodCount)}
        />
        <QuarterlyMetricCard
          description={t("tax.quarters.summary.documents")}
          value={formatFiscalNumber(summary.documentCount)}
        />
        <QuarterlyMetricCard
          description={t("tax.quarters.summary.review")}
          value={formatFiscalNumber(summary.reviewCount)}
        />
        <QuarterlyMetricCard
          description={t("tax.quarters.summary.blocked")}
          value={formatFiscalNumber(summary.blockingCount)}
        />
        <QuarterlyMetricCard
          description={t("tax.quarters.summary.model303")}
          value={formatFiscalNumber(summary.model303Count)}
        />
        <QuarterlyMetricCard
          description={t("tax.quarters.summary.model115")}
          value={formatFiscalNumber(summary.model115Count)}
        />
      </section>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{t("tax.quarters.table.title")}</CardTitle>
          <CardDescription>{t("tax.quarters.table.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {drafts.length === 0 ? (
            <QuarterlyEmptyState
              title={t("tax.quarters.empty.title")}
              description={t("tax.quarters.empty.description")}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("tax.quarters.fields.period")}</TableHead>
                  <TableHead>{t("tax.quarters.fields.operationalStatus")}</TableHead>
                  <TableHead>{t("tax.quarters.fields.periodStatus")}</TableHead>
                  <TableHead className="text-right">{t("tax.quarters.fields.documents")}</TableHead>
                  <TableHead className="text-right">{t("tax.quarters.fields.review")}</TableHead>
                  <TableHead className="text-right">{t("tax.quarters.fields.blocked")}</TableHead>
                  <TableHead className="text-right">{t("tax.quarters.fields.model303")}</TableHead>
                  <TableHead className="text-right">{t("tax.quarters.fields.model115")}</TableHead>
                  <TableHead className="text-right">{t("tax.quarters.fields.payable")}</TableHead>
                  <TableHead className="text-right">{t("tax.quarters.fields.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drafts.map((draft) => (
                  <TableRow key={draft.period.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{draft.period.periodKey}</p>
                        <p className="text-xs text-muted-foreground">
                          {draft.period.startsOn} - {draft.period.endsOn}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <QuarterlyOperationalStatusBadge
                        code={draft.operationalStatus.code}
                        t={t}
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {getPeriodStatusLabel(draft.period.status, t)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatFiscalNumber(draft.totals.documentCount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatFiscalNumber(draft.operationalStatus.reviewDocumentCount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatFiscalNumber(draft.operationalStatus.blockingDocumentCount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatFiscalNumber(draft.totals.model303DocumentCount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatFiscalNumber(draft.totals.model115DocumentCount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatFiscalMoney(draft.totals.totalPayableCents, draft.period.currencyCode)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={draft.periodHref}>{t("tax.quarters.actions.openQuarter")}</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
