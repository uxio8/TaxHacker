import { closeFiscalPeriodAction, reopenFiscalPeriodAction } from "@/app/(app)/tax/close/actions"
import { QuarterlyEmptyState, QuarterlyMetricCard, QuarterlyOperationalStatusBadge, formatFiscalNumber, getPeriodStatusLabel } from "@/components/tax/quarters/quarterly-shared"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import { AlertCircle, CheckCircle2 } from "lucide-react"
import Link from "next/link"

type CloseFeedback = {
  action: "closed" | "reopened" | "error" | null
  message: string | null
  period: string | null
}

function buildCloseSummary(drafts: QuarterlyDraft[]) {
  return drafts.reduce(
    (summary, draft) => {
      summary.periodCount += 1

      if (
        draft.operationalStatus.code === "ready" &&
        draft.period.status !== "closed" &&
        draft.period.status !== "presented"
      ) {
        summary.readyCount += 1
      }

      if (
        draft.operationalStatus.code === "review_pending" ||
        draft.operationalStatus.code === "review_blocked" ||
        draft.operationalStatus.code === "open"
      ) {
        summary.reviewCount += 1
      }

      if (draft.period.status === "closed" || draft.period.status === "presented") {
        summary.closedCount += 1
      }

      return summary
    },
    {
      periodCount: 0,
      readyCount: 0,
      reviewCount: 0,
      closedCount: 0,
    }
  )
}

function CloseFeedbackBanner({
  feedback,
  t,
}: {
  feedback: CloseFeedback
  t: Translator
}) {
  if (!feedback.action) {
    return null
  }

  const period = feedback.period ?? "—"

  if (feedback.action === "error") {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t("tax.close.title")}</AlertTitle>
        <AlertDescription>
          {t("tax.close.feedback.error", { message: feedback.message ?? period })}
        </AlertDescription>
      </Alert>
    )
  }

  const description =
    feedback.message ??
    (feedback.action === "closed"
      ? t("tax.close.feedback.closed", { period })
      : t("tax.close.feedback.reopened", { period }))

  return (
    <Alert>
      <CheckCircle2 className="h-4 w-4" />
      <AlertTitle>{t("tax.close.title")}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  )
}

export function ClosePeriodsPanel({
  drafts,
  feedback,
  profileName,
  profileTaxId,
  t,
}: {
  drafts: QuarterlyDraft[]
  feedback: CloseFeedback
  profileName: string
  profileTaxId: string
  t: Translator
}) {
  const summary = buildCloseSummary(drafts)

  return (
    <section className="flex flex-col gap-6">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <Card className="shadow-sm">
          <CardHeader className="gap-3">
            <div className="w-fit rounded-md border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("tax.close.eyebrow")}
            </div>
            <div className="space-y-2">
              <CardTitle className="text-3xl tracking-tight">{t("tax.close.title")}</CardTitle>
              <CardDescription className="max-w-2xl text-sm sm:text-base">
                {t("tax.close.description")}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>{t("tax.close.profile.title")}</CardTitle>
            <CardDescription>{t("tax.close.profile.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-medium">{profileName}</p>
              <p className="text-muted-foreground">{profileTaxId}</p>
            </div>
            <p className="text-muted-foreground">{t("tax.close.profile.scope")}</p>
          </CardContent>
        </Card>
      </section>

      <CloseFeedbackBanner feedback={feedback} t={t} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <QuarterlyMetricCard
          description={t("tax.close.summary.periods")}
          value={formatFiscalNumber(summary.periodCount)}
        />
        <QuarterlyMetricCard
          description={t("tax.close.summary.ready")}
          value={formatFiscalNumber(summary.readyCount)}
        />
        <QuarterlyMetricCard
          description={t("tax.close.summary.review")}
          value={formatFiscalNumber(summary.reviewCount)}
        />
        <QuarterlyMetricCard
          description={t("tax.close.summary.closed")}
          value={formatFiscalNumber(summary.closedCount)}
        />
      </section>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{t("tax.close.table.title")}</CardTitle>
          <CardDescription>{t("tax.close.table.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {drafts.length === 0 ? (
            <QuarterlyEmptyState
              title={t("tax.close.empty.title")}
              description={t("tax.close.empty.description")}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("tax.close.fields.period")}</TableHead>
                  <TableHead>{t("tax.close.fields.operationalStatus")}</TableHead>
                  <TableHead>{t("tax.close.fields.periodStatus")}</TableHead>
                  <TableHead className="text-right">{t("tax.close.fields.documents")}</TableHead>
                  <TableHead className="text-right">{t("tax.close.fields.review")}</TableHead>
                  <TableHead className="text-right">{t("tax.close.fields.blocked")}</TableHead>
                  <TableHead>{t("tax.close.fields.reason")}</TableHead>
                  <TableHead className="text-right">{t("tax.close.fields.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drafts.map((draft) => {
                  const isClosed =
                    draft.period.status === "closed" || draft.period.status === "presented"
                  const canClose =
                    draft.operationalStatus.code === "ready" &&
                    draft.period.status !== "closed" &&
                    draft.period.status !== "presented"

                  return (
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
                        <QuarterlyOperationalStatusBadge code={draft.operationalStatus.code} t={t} />
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
                      <TableCell>
                        {isClosed ? (
                          <form action={reopenFiscalPeriodAction} className="flex min-w-64 gap-2">
                            <input type="hidden" name="periodKey" value={draft.period.periodKey} />
                            <Input
                              name="reason"
                              placeholder={t("tax.close.reason.placeholder")}
                              required
                            />
                            <Button type="submit" variant="outline">
                              {t("tax.close.actions.reopen")}
                            </Button>
                          </form>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {canClose ? "—" : t("tax.close.helper.notReady")}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {canClose ? (
                          <form action={closeFiscalPeriodAction}>
                            <input type="hidden" name="periodKey" value={draft.period.periodKey} />
                            <Button type="submit">{t("tax.close.actions.close")}</Button>
                          </form>
                        ) : (
                          <div className="flex justify-end">
                            <Button asChild variant="outline">
                              <Link href={`/tax/quarters/${draft.period.periodKey}`}>
                                {t("tax.close.actions.openQuarter")}
                              </Link>
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
