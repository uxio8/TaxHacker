import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { MessageKey, Translator } from "@/lib/i18n"
import type { TaxAttention } from "@/models/tax-attention"

const ACTIVE_QUARTER_STATUS_MESSAGE_KEYS: Record<
  NonNullable<TaxAttention["activeQuarter"]>["status"],
  MessageKey
> = {
  open: "tax.quarters.status.operational.open",
  review_pending: "tax.quarters.status.operational.review_pending",
  review_blocked: "tax.quarters.status.operational.review_blocked",
  ready: "tax.quarters.status.operational.ready",
  presented: "tax.quarters.status.operational.presented",
  closed: "tax.quarters.status.operational.closed",
}

function getActiveQuarterStatusLabel(attention: TaxAttention | null, t: Translator) {
  if (!attention?.activeQuarter) {
    return t("tax.archive.scope.none")
  }

  return t(ACTIVE_QUARTER_STATUS_MESSAGE_KEYS[attention.activeQuarter.status])
}

export function TaxWorkspaceHeader({
  t,
  attention,
  companyName,
  companyTaxId,
}: {
  t: Translator
  attention: TaxAttention | null
  companyName: string | null
  companyTaxId: string | null
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
      <Card className="shadow-sm">
        <CardHeader className="gap-3">
          <Badge variant="secondary" className="w-fit">
            {t("common.tax")}
          </Badge>
          <div className="space-y-2">
            <CardTitle className="text-3xl tracking-tight">{t("tax.title")}</CardTitle>
            <CardDescription className="max-w-2xl text-sm sm:text-base">
              {t("tax.description")}
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="gap-2">
          <CardTitle>{t("tax.scope.title")}</CardTitle>
          <CardDescription>{t("tax.scope.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {companyName ? (
            <div>
              <p className="font-medium text-foreground">{companyName}</p>
              {companyTaxId ? <p>{companyTaxId}</p> : null}
            </div>
          ) : null}
          <p>{t("tax.scope.entity")}</p>
          <p>
            <span className="font-medium text-foreground">{t("tax.quarters.fields.period")}:</span>{" "}
            {attention?.activeQuarter?.periodKey ?? t("tax.archive.scope.none")}
          </p>
          <p>
            <span className="font-medium text-foreground">
              {t("tax.quarters.fields.operationalStatus")}:
            </span>{" "}
            {getActiveQuarterStatusLabel(attention, t)}
          </p>
        </CardContent>
      </Card>
    </section>
  )
}
