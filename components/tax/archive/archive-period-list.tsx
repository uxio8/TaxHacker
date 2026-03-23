import { Badge } from "@/components/ui/badge"
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
import type { MessageKey, Translator } from "@/lib/i18n"
import type { LegalArchivePeriodListItem } from "@/models/fiscal/legal-archive"
import Link from "next/link"

const PERIOD_STATUS_MESSAGE_KEYS = {
  closed: "tax.archive.status.closed",
  in_review: "tax.archive.status.inReview",
  open: "tax.archive.status.open",
  presented: "tax.archive.status.presented",
  ready: "tax.archive.status.ready",
} as const satisfies Record<string, MessageKey>

type ArchivePeriodStatus = keyof typeof PERIOD_STATUS_MESSAGE_KEYS

function isArchivePeriodStatus(status: string): status is ArchivePeriodStatus {
  return status in PERIOD_STATUS_MESSAGE_KEYS
}

function getPeriodStatusLabel(status: string, t: Translator) {
  return t(
    isArchivePeriodStatus(status)
      ? PERIOD_STATUS_MESSAGE_KEYS[status]
      : "tax.archive.status.unknown"
  )
}

export function ArchivePeriodList({
  periods,
  t,
}: {
  periods: LegalArchivePeriodListItem[]
  t: Translator
}) {
  if (periods.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{t("tax.archive.list.empty.title")}</CardTitle>
          <CardDescription>{t("tax.archive.list.empty.description")}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const totals = periods.reduce(
    (summary, item) => ({
      expectedSourceCount:
        summary.expectedSourceCount + item.manifest.totals.expectedSourceCount,
      missingSourceCount:
        summary.missingSourceCount + item.manifest.totals.missingSourceCount,
      unexpectedSourceCount:
        summary.unexpectedSourceCount + item.manifest.totals.unexpectedSourceCount,
      unresolvedAttachmentCount:
        summary.unresolvedAttachmentCount + item.attachmentResolution.unresolvedAttachmentCount,
    }),
    {
      expectedSourceCount: 0,
      missingSourceCount: 0,
      unexpectedSourceCount: 0,
      unresolvedAttachmentCount: 0,
    }
  )

  return (
    <section className="space-y-6" aria-label={t("tax.archive.list.sectionLabel")}>
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="gap-2">
            <CardDescription>{t("tax.archive.summary.periods")}</CardDescription>
            <CardTitle className="text-3xl tracking-tight">{periods.length}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="gap-2">
            <CardDescription>{t("tax.archive.summary.expectedSources")}</CardDescription>
            <CardTitle className="text-3xl tracking-tight">{totals.expectedSourceCount}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="gap-2">
            <CardDescription>{t("tax.archive.summary.missingSources")}</CardDescription>
            <CardTitle className="text-3xl tracking-tight">{totals.missingSourceCount}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="gap-2">
            <CardDescription>{t("tax.archive.summary.unresolvedAttachments")}</CardDescription>
            <CardTitle className="text-3xl tracking-tight">{totals.unresolvedAttachmentCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="gap-2">
          <CardTitle>{t("tax.archive.list.title")}</CardTitle>
          <CardDescription>{t("tax.archive.list.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("tax.archive.fields.period")}</TableHead>
                <TableHead>{t("tax.archive.fields.range")}</TableHead>
                <TableHead>{t("tax.archive.fields.status")}</TableHead>
                <TableHead className="text-right">{t("tax.archive.fields.expectedSources")}</TableHead>
                <TableHead className="text-right">{t("tax.archive.fields.missingSources")}</TableHead>
                <TableHead className="text-right">{t("tax.archive.fields.unexpectedSources")}</TableHead>
                <TableHead className="text-right">
                  {t("tax.archive.fields.unresolvedAttachments")}
                </TableHead>
                <TableHead className="text-right">{t("tax.archive.fields.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.map((item) => (
                <TableRow key={item.period.id}>
                  <TableCell className="font-medium">{item.period.periodKey}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.period.startsOn} - {item.period.endsOn}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{getPeriodStatusLabel(item.period.status, t)}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{item.manifest.totals.expectedSourceCount}</TableCell>
                  <TableCell className="text-right">{item.manifest.totals.missingSourceCount}</TableCell>
                  <TableCell className="text-right">{item.manifest.totals.unexpectedSourceCount}</TableCell>
                  <TableCell className="text-right">
                    {item.attachmentResolution.unresolvedAttachmentCount}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/tax/archive/${item.period.periodKey}`}>
                        {t("tax.archive.list.openPeriod")}
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  )
}
