import {
  TAX_WORKSPACE_MODULES,
  TAX_WORKSPACE_QUICK_LINKS,
  type TaxWorkspaceModuleId,
  type TaxWorkspaceModuleStatus,
  type TaxWorkspaceQuickLinkId,
} from "@/components/tax/layout/content"
import { TaxNextActionCard } from "@/components/tax/layout/tax-next-action-card"
import {
  ObligationsCockpit,
  type ObligationCockpitItem,
} from "@/components/tax/obligations/obligations-cockpit"
import {
  AnnualFiscalOverviewCard,
  type AnnualFiscalOverview,
} from "@/components/tax/obligations/annual-fiscal-overview-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { MessageKey, Translator } from "@/lib/i18n"
import type { TaxAttention } from "@/models/tax-attention"
import {
  Archive,
  ClockArrowUp,
  FileCheck2,
  FileText,
  FolderKanban,
  Lock,
  SearchCheck,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"

const MODULE_ICONS: Record<TaxWorkspaceModuleId, LucideIcon> = {
  quarters: FolderKanban,
  review: SearchCheck,
  forms: FileCheck2,
  archive: Archive,
  close: Lock,
}

const MODULE_MESSAGE_KEYS: Record<
  TaxWorkspaceModuleId,
  { description: MessageKey; title: MessageKey }
> = {
  quarters: {
    description: "tax.modules.quarters.description",
    title: "tax.modules.quarters.title",
  },
  review: {
    description: "tax.modules.review.description",
    title: "tax.modules.review.title",
  },
  forms: {
    description: "tax.modules.forms.description",
    title: "tax.modules.forms.title",
  },
  archive: {
    description: "tax.modules.archive.description",
    title: "tax.modules.archive.title",
  },
  close: {
    description: "tax.modules.close.description",
    title: "tax.modules.close.title",
  },
}

const QUICK_LINK_ICONS: Record<TaxWorkspaceQuickLinkId, LucideIcon> = {
  transactions: FileText,
  unsorted: ClockArrowUp,
}

const QUICK_LINK_MESSAGE_KEYS: Record<
  TaxWorkspaceQuickLinkId,
  { description: MessageKey; title: MessageKey }
> = {
  transactions: {
    description: "tax.quickLinks.transactions.description",
    title: "tax.quickLinks.transactions.title",
  },
  unsorted: {
    description: "tax.quickLinks.unsorted.description",
    title: "tax.quickLinks.unsorted.title",
  },
}

const MODULE_STATUS_MESSAGE_KEYS: Record<TaxWorkspaceModuleStatus, MessageKey> = {
  available: "tax.modules.status.available",
  upcoming: "tax.modules.status.upcoming",
}

const ATTENTION_SUMMARY_CARDS = [
  {
    descriptionKey: "tax.quarters.summary.periodsDescription",
    titleKey: "tax.quarters.fields.period",
  },
  {
    descriptionKey: "tax.review.summary.blockedDescription",
    titleKey: "tax.review.summary.blocked",
  },
  {
    descriptionKey: "tax.review.summary.needsReviewDescription",
    titleKey: "tax.review.summary.needsReview",
  },
] as const

export function TaxWorkspaceSections({
  t,
  attention,
  setupHref,
  obligations = [],
  annualOverview,
}: {
  t: Translator
  attention: TaxAttention | null
  setupHref?: string
  obligations?: ObligationCockpitItem[]
  annualOverview?: AnnualFiscalOverview
}) {
  const summaryValues = [
    attention?.activeQuarter?.periodKey ?? t("tax.archive.scope.none"),
    String(attention?.summary.blockedDocuments ?? 0),
    String(attention?.summary.needsReviewDocuments ?? 0),
  ]

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <TaxNextActionCard t={t} attention={attention} setupHref={setupHref} />

        <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
          {ATTENTION_SUMMARY_CARDS.map((card, index) => (
            <Card key={card.titleKey} className="shadow-sm">
              <CardHeader className="gap-2">
                <CardDescription>{t(card.titleKey)}</CardDescription>
                <CardTitle className={index === 0 ? "text-2xl tracking-tight" : "text-3xl tracking-tight"}>
                  {summaryValues[index]}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t(card.descriptionKey)}</p>
              </CardContent>
            </Card>
          ))}
        </section>
      </section>

      <ObligationsCockpit obligations={obligations} />
      <AnnualFiscalOverviewCard annualOverview={annualOverview} />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <Card className="shadow-sm">
          <CardHeader className="gap-2">
            <CardTitle>{t("tax.modules.title")}</CardTitle>
            <CardDescription>{t("tax.modules.description")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {TAX_WORKSPACE_MODULES.map((module) => {
              const Icon = MODULE_ICONS[module.id]
              const messageKeys = MODULE_MESSAGE_KEYS[module.id]
              const isAvailable = module.status === "available"

              return (
                <article key={module.id} className="flex flex-col rounded-lg border bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-background">
                      <Icon className="h-5 w-5" />
                    </div>
                    <Badge variant={isAvailable ? "secondary" : "outline"}>
                      {t(MODULE_STATUS_MESSAGE_KEYS[module.status])}
                    </Badge>
                  </div>
                  <div className="mt-4 flex-1 space-y-2">
                    <h3 className="font-semibold">{t(messageKeys.title)}</h3>
                    <p className="text-sm text-muted-foreground">{t(messageKeys.description)}</p>
                  </div>
                  {isAvailable ? (
                    <Button asChild variant="outline" className="mt-4 w-full justify-center">
                      <Link href={module.href}>{t("tax.modules.open")}</Link>
                    </Button>
                  ) : null}
                </article>
              )
            })}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="gap-2">
            <CardTitle>{t("tax.quickLinks.title")}</CardTitle>
            <CardDescription>{t("tax.quickLinks.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {TAX_WORKSPACE_QUICK_LINKS.map((link) => {
              const Icon = QUICK_LINK_ICONS[link.id]
              const messageKeys = QUICK_LINK_MESSAGE_KEYS[link.id]

              return (
                <div key={link.id} className="rounded-lg border p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted/20">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <h3 className="font-semibold">{t(messageKeys.title)}</h3>
                      <p className="text-sm text-muted-foreground">{t(messageKeys.description)}</p>
                    </div>
                  </div>
                  <Button asChild variant="outline" className="mt-4 w-full justify-center">
                    <Link href={link.href}>{t("tax.quickLinks.open")}</Link>
                  </Button>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
