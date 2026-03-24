import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Translator } from "@/lib/i18n"
import type { TaxAttention } from "@/models/tax-attention"
import Link from "next/link"

const NEXT_ACTION_MODULE_MESSAGE_KEYS = {
  review: {
    description: "tax.modules.review.description",
    title: "tax.modules.review.title",
  },
  quarters: {
    description: "tax.modules.quarters.description",
    title: "tax.modules.quarters.title",
  },
} as const

function getActionEyebrow(attention: TaxAttention | null, t: Translator) {
  if (!attention) {
    return t("tax.review.setup.title")
  }

  switch (attention.nextAction.kind) {
    case "review_blocked":
      return t("tax.review.summary.blocked")
    case "review_queue":
      return t("tax.review.summary.needsReview")
    case "open_active_quarter":
      return attention.activeQuarter?.periodKey ?? t("tax.modules.quarters.title")
    case "open_quarters":
      return t("tax.quarters.title")
  }
}

function getActionDetails(attention: TaxAttention | null, t: Translator) {
  if (!attention) {
    return [
      {
        label: t("tax.quarters.fields.period"),
        value: t("tax.archive.scope.none"),
      },
    ]
  }

  return [
    {
      label: t("tax.quarters.fields.period"),
      value: attention.activeQuarter?.periodKey ?? t("tax.archive.scope.none"),
    },
    {
      label: t("tax.review.summary.blocked"),
      value: String(attention.summary.blockedDocuments),
    },
    {
      label: t("tax.review.summary.needsReview"),
      value: String(attention.summary.needsReviewDocuments),
    },
  ]
}

export function TaxNextActionCard({
  t,
  attention,
  setupHref,
}: {
  t: Translator
  attention: TaxAttention | null
  setupHref?: string
}) {
  if (!attention && !setupHref) {
    return null
  }

  if (!attention) {
    const href = setupHref ?? "/settings/fiscal"

    return (
      <Card className="shadow-sm">
        <CardHeader className="gap-3">
          <Badge variant="secondary" className="w-fit">
            {getActionEyebrow(attention, t)}
          </Badge>
          <div className="space-y-2">
            <CardTitle>{t("tax.review.setup.title")}</CardTitle>
            <CardDescription className="max-w-2xl">{t("tax.review.setup.description")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {getActionDetails(attention, t).map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2">
              <span className="text-sm text-muted-foreground">{item.label}</span>
              <span className="text-sm font-medium">{item.value}</span>
            </div>
          ))}
          <Button asChild className="w-full sm:w-auto">
            <Link href={href}>{t("tax.review.setup.action")}</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const messageKeys = NEXT_ACTION_MODULE_MESSAGE_KEYS[attention.nextAction.moduleId]

  return (
    <Card className="shadow-sm">
      <CardHeader className="gap-3">
        <Badge variant="secondary" className="w-fit">
          {getActionEyebrow(attention, t)}
        </Badge>
        <div className="space-y-2">
          <CardTitle>{t(messageKeys.title)}</CardTitle>
          <CardDescription className="max-w-2xl">{t(messageKeys.description)}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          {getActionDetails(attention, t).map((item) => (
            <div key={item.label} className="rounded-lg border bg-muted/20 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-1 text-sm font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href={attention.nextAction.href}>{t("tax.modules.open")}</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
