import { Badge } from "@/components/ui/badge"
import type { Translator } from "@/lib/i18n"
import { REVIEW_STATUS_BLOCKED, type ReviewStatus } from "@/models/fiscal/review-status"

export function ReviewStatusBadge({ status, t }: { status: ReviewStatus; t: Translator }) {
  if (status === REVIEW_STATUS_BLOCKED) {
    return <Badge variant="destructive">{t("tax.review.status.blocked")}</Badge>
  }

  return <Badge variant="outline">{t("tax.review.status.needs_review")}</Badge>
}
