import { ReviewQueueList } from "@/components/tax/review/review-queue-list"
import { ReviewSummary } from "@/components/tax/review/review-summary"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FiscalStorageNotReady } from "@/components/tax/fiscal-storage-not-ready"
import { getCurrentUser } from "@/lib/auth"
import { createPageMetadata, createTranslator } from "@/lib/i18n"
import { requireCurrentOrganizationId } from "@/lib/tenant"
import { getFiscalProfileAccessByOrganizationId } from "@/models/fiscal/profile"
import { getFiscalReviewQueue } from "@/models/fiscal/review-queue"
import { isFiscalStorageNotReadyError } from "@/models/fiscal/storage"
import Link from "next/link"

export const metadata = createPageMetadata("tax.review.title", {
  descriptionKey: "tax.review.description",
})

export default async function TaxReviewPage() {
  const t = createTranslator()
  const user = await getCurrentUser()
  const organizationId = await requireCurrentOrganizationId({
    getCurrentUser: async () => user,
  })
  const fiscalProfileAccess = await getFiscalProfileAccessByOrganizationId(organizationId, user.id)

  if (fiscalProfileAccess.status === "storage_not_ready") {
    return (
      <main className="flex w-full max-w-5xl self-center flex-col gap-6 p-5">
        <Card className="shadow-sm">
          <CardHeader className="gap-3">
            <div className="w-fit rounded-md border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("tax.review.eyebrow")}
            </div>
            <div className="space-y-2">
              <CardTitle className="text-3xl tracking-tight">{t("tax.review.title")}</CardTitle>
              <CardDescription className="max-w-2xl text-sm sm:text-base">
                {t("tax.review.description")}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        <FiscalStorageNotReady t={t} />
      </main>
    )
  }

  if (fiscalProfileAccess.status !== "ready") {
    return (
      <main className="flex w-full max-w-5xl self-center flex-col gap-6 p-5">
        <Card className="shadow-sm">
          <CardHeader className="gap-3">
            <div className="w-fit rounded-md border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("tax.review.eyebrow")}
            </div>
            <div className="space-y-2">
              <CardTitle className="text-3xl tracking-tight">{t("tax.review.title")}</CardTitle>
              <CardDescription className="max-w-2xl text-sm sm:text-base">
                {t("tax.review.description")}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>{t("tax.review.setup.title")}</CardTitle>
            <CardDescription>{t("tax.review.setup.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/settings/fiscal">{t("tax.review.setup.action")}</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  let queue

  try {
    queue = await getFiscalReviewQueue(fiscalProfileAccess.profile.id)
  } catch (error) {
    if (isFiscalStorageNotReadyError(error)) {
      return (
        <main className="flex w-full max-w-5xl self-center flex-col gap-6 p-5">
          <Card className="shadow-sm">
            <CardHeader className="gap-3">
              <div className="w-fit rounded-md border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("tax.review.eyebrow")}
              </div>
              <div className="space-y-2">
                <CardTitle className="text-3xl tracking-tight">{t("tax.review.title")}</CardTitle>
                <CardDescription className="max-w-2xl text-sm sm:text-base">
                  {t("tax.review.description")}
                </CardDescription>
              </div>
            </CardHeader>
          </Card>

          <FiscalStorageNotReady t={t} />
        </main>
      )
    }

    throw error
  }

  return (
    <main className="flex w-full max-w-6xl self-center flex-col gap-6 p-5">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <Card className="shadow-sm">
          <CardHeader className="gap-3">
            <div className="w-fit rounded-md border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("tax.review.eyebrow")}
            </div>
            <div className="space-y-2">
              <CardTitle className="text-3xl tracking-tight">{t("tax.review.title")}</CardTitle>
              <CardDescription className="max-w-2xl text-sm sm:text-base">
                {t("tax.review.description")}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>{t("tax.review.profile.title")}</CardTitle>
            <CardDescription>{t("tax.review.profile.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-medium">{fiscalProfileAccess.profile.companyName}</p>
              <p className="text-muted-foreground">{fiscalProfileAccess.profile.taxId}</p>
            </div>
            <p className="text-muted-foreground">{t("tax.review.profile.scope")}</p>
          </CardContent>
        </Card>
      </section>

      <ReviewSummary summary={queue.summary} t={t} />
      <ReviewQueueList items={queue.items} t={t} />
    </main>
  )
}
