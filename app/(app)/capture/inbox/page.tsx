import { MobileInbox } from "@/components/capture/mobile-inbox"
import type { MobileInboxItem, MobileSystemStatus } from "@/components/capture/mobile-contract"
import { Card } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import config from "@/lib/config"
import { createPageMetadata, createTranslator } from "@/lib/i18n"
import { requireCurrentOrganizationId } from "@/lib/tenant"
import { getCurrentOrganizationUserBillingProjection } from "@/models/billing/access"
import { buildOrganizationActionUser } from "@/models/billing/runtime"
import { getFiscalProfileAccessByOrganizationId } from "@/models/fiscal/profile"
import { getFiscalReviewQueue } from "@/models/fiscal/review-queue"
import { getCaptureWorkflowInboxView } from "@/models/workflow/document-read-api"
import { cookies } from "next/headers"

interface InboxPageResponse {
  items: MobileInboxItem[]
  systemStatus: MobileSystemStatus
}

export const metadata = createPageMetadata("capture.inbox.title", {
  descriptionKey: "capture.inbox.description",
})

const EMPTY_INBOX_RESPONSE: InboxPageResponse = {
  items: [],
  systemStatus: {
    llmConfigured: true,
    workerAvailable: true,
    storageAvailable: true,
    blockingReasonCode: null,
  },
}

export default async function CaptureInboxPage() {
  const t = createTranslator()
  const user = await getCurrentUser()
  const organizationId = await requireCurrentOrganizationId({
    getCurrentUser: async () => user,
  })
  let inbox = EMPTY_INBOX_RESPONSE
  let openClientReviewRequestCount = 0

  if (config.workflow.documentSliceEnabled) {
    const billingProjection = await getCurrentOrganizationUserBillingProjection(organizationId)
    const actionUser = buildOrganizationActionUser(
      {
        id: user.id,
        email: user.email,
      },
      {
        organizationId,
        storageLimit: billingProjection.storageLimit,
        storageUsed: billingProjection.storageUsed,
        membershipExpiresAt: billingProjection.membershipExpiresAt,
        accessStatus: billingProjection.accessStatus,
      }
    )
    const workflowView = await getCaptureWorkflowInboxView(actionUser)

    inbox = workflowView.inbox
    openClientReviewRequestCount = workflowView.openClientReviewRequestCount
  } else {
    const cookieStore = await cookies()
    const cookie = cookieStore.getAll().map((item) => `${item.name}=${item.value}`).join("; ")

    try {
      const response = await fetch(`${config.app.baseURL}/api/mobile/inbox`, {
        cache: "no-store",
        headers: {
          cookie,
        },
      })

      if (response.ok) {
        inbox = (await response.json()) as InboxPageResponse
      }
    } catch {
      inbox = EMPTY_INBOX_RESPONSE
    }

    const fiscalProfileAccess = await getFiscalProfileAccessByOrganizationId(organizationId, user.id)
    if (fiscalProfileAccess.status === "ready") {
      const reviewQueue = await getFiscalReviewQueue(fiscalProfileAccess.profile.id)
      openClientReviewRequestCount = reviewQueue.items.filter((item) => item.owner === "client").length
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 [@media(display-mode:standalone)]:gap-4">
      <div className="space-y-2 [@media(display-mode:standalone)]:space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{t("capture.inbox.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("capture.inbox.description")}</p>
      </div>

      <Card className="rounded-[28px] border-slate-200 p-5 [@media(display-mode:standalone)]:rounded-2xl [@media(display-mode:standalone)]:p-4">
        <MobileInbox
          initialItems={inbox.items}
          initialSystemStatus={inbox.systemStatus}
          openClientReviewRequestCount={openClientReviewRequestCount}
        />
      </Card>
    </main>
  )
}
