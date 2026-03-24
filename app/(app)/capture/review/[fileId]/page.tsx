import {
  buildDesktopUrl,
  getInitialReviewDraft,
  type MobileConfidence,
  type MobileItemState,
  type MobileReasonCode,
} from "@/components/capture/mobile-contract"
import { MobileReview } from "@/components/capture/mobile-review"
import {
  acceptMobileReviewAction,
  deferMobileReviewAction,
  retryMobileReviewAction,
} from "@/app/(app)/capture/review/[fileId]/actions"
import { getCurrentUser } from "@/lib/auth"
import config from "@/lib/config"
import { createPageMetadata, createTranslator } from "@/lib/i18n"
import { requireCurrentOrganizationId } from "@/lib/tenant"
import { getFileById } from "@/models/files"
import { getSettings } from "@/models/settings"
import { cookies } from "next/headers"
import { notFound } from "next/navigation"

interface ReviewPageInboxItem {
  fileId: string
  state: MobileItemState
  reasonCode: MobileReasonCode | null
  confidence: MobileConfidence | null
}

interface ReviewPageInboxResponse {
  items: ReviewPageInboxItem[]
}

export const metadata = createPageMetadata("capture.review.title", {
  descriptionKey: "capture.review.description",
})

function isMobileCaptureFile(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") {
    return false
  }

  const mobileTriage = (metadata as { mobileTriage?: { source?: string } }).mobileTriage
  return mobileTriage?.source === "mobile_capture"
}

export default async function CaptureReviewPage({ params }: { params: Promise<{ fileId: string }> }) {
  const t = createTranslator()
  const { fileId } = await params
  const user = await getCurrentUser()
  const organizationId = await requireCurrentOrganizationId({
    getCurrentUser: async () => user,
  })
  const [file, settings] = await Promise.all([getFileById(fileId, organizationId), getSettings(organizationId)])

  if (!file || !isMobileCaptureFile(file.metadata)) {
    notFound()
  }

  const cookieStore = await cookies()
  const cookie = cookieStore.getAll().map((item) => `${item.name}=${item.value}`).join("; ")
  const inboxResponse = await fetch(`${config.app.baseURL}/api/mobile/inbox`, {
    cache: "no-store",
    headers: {
      cookie,
    },
  })

  const inboxPayload = inboxResponse.ok ? ((await inboxResponse.json()) as ReviewPageInboxResponse) : null
  const inboxItem = inboxPayload?.items.find((item) => item.fileId === file.id)

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t("capture.review.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("capture.review.description")}</p>
      </div>

      <MobileReview
        fileId={file.id}
        filename={file.filename}
        previewUrl={`/files/preview/${file.id}`}
        desktopUrl={buildDesktopUrl(file.id)}
        state={inboxItem?.state || "ready_for_review"}
        reasonCode={inboxItem?.reasonCode || null}
        confidence={inboxItem?.confidence || null}
        initialDraft={getInitialReviewDraft({
          defaults: {
            categoryCode: settings.default_category || "",
            currencyCode: settings.default_currency || "EUR",
          },
          parseResult:
            typeof file.cachedParseResult === "object" && file.cachedParseResult !== null
              ? (file.cachedParseResult as Record<string, unknown>)
              : null,
        })}
        onAccept={acceptMobileReviewAction}
        onRetry={retryMobileReviewAction}
        onDefer={deferMobileReviewAction}
      />
    </main>
  )
}
