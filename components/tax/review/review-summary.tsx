import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Translator } from "@/lib/i18n"
import type { ReviewQueueSummary } from "@/models/fiscal/review-queue"

type SummaryCard = {
  description: string
  title: string
  value: number
}

export function ReviewSummary({
  summary,
  t,
}: {
  summary: ReviewQueueSummary
  t: Translator
}) {
  const cards: SummaryCard[] = [
    {
      title: t("tax.review.summary.total"),
      description: t("tax.review.summary.totalDescription"),
      value: summary.total,
    },
    {
      title: t("tax.review.summary.blocked"),
      description: t("tax.review.summary.blockedDescription"),
      value: summary.blocked,
    },
    {
      title: t("tax.review.summary.needsReview"),
      description: t("tax.review.summary.needsReviewDescription"),
      value: summary.needs_review,
    },
  ]

  return (
    <section className="grid gap-4 md:grid-cols-3" aria-label={t("tax.review.summary.sectionLabel")}>
      {cards.map((card) => (
        <Card key={card.title} className="shadow-sm">
          <CardHeader className="gap-2">
            <CardDescription>{card.title}</CardDescription>
            <CardTitle className="text-3xl tracking-tight">{card.value}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </section>
  )
}
