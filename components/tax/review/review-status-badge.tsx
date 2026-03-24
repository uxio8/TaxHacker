import { Badge } from "@/components/ui/badge"
import type { Translator } from "@/lib/i18n"
import { getReviewStatusLabel } from "@/components/tax/quarters/quarterly-shared"
import { REVIEW_STATUS_BLOCKED, type ReviewStatus } from "@/models/fiscal/review-status"

export function ReviewStatusBadge({ status, t }: { status: ReviewStatus; t: Translator }) {
  if (status === REVIEW_STATUS_BLOCKED) {
    return <Badge variant="destructive">{getReviewStatusLabel(status, t)}</Badge>
  }

  return <Badge variant="outline">{getReviewStatusLabel(status, t)}</Badge>
}
