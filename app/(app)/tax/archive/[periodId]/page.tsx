import { ArchiveFiscalProfileRequired } from "@/components/tax/archive/archive-fiscal-profile-required"
import { ArchiveManifestView } from "@/components/tax/archive/archive-manifest-view"
import { FiscalStorageNotReady } from "@/components/tax/fiscal-storage-not-ready"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import config from "@/lib/config"
import { createPageMetadata, createTranslator } from "@/lib/i18n"
import { requireCurrentOrganizationId } from "@/lib/tenant"
import { getLegalArchivePeriodDetail } from "@/models/fiscal/legal-archive"
import { syncDefaultSpanishFiscalPeriodsV1 } from "@/models/fiscal/periods"
import { getFiscalProfileAccessByOrganizationId } from "@/models/fiscal/profile"
import { isFiscalStorageNotReadyError } from "@/models/fiscal/storage"
import { getTaxArchivePeriodWorkflowView } from "@/models/workflow/fiscal-read-api"
import Link from "next/link"
import { notFound } from "next/navigation"

export const metadata = createPageMetadata("tax.archive.detail.meta.title", {
  descriptionKey: "tax.archive.detail.meta.description",
})

export default async function TaxArchiveDetailPage({
  params,
}: {
  params: Promise<{ periodId: string }>
}) {
  const t = createTranslator()
  const { periodId } = await params
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
              {t("tax.archive.eyebrow")}
            </div>
            <div className="space-y-2">
              <CardTitle className="text-3xl tracking-tight">{t("tax.archive.title")}</CardTitle>
              <CardDescription className="max-w-2xl text-sm sm:text-base">
                {t("tax.archive.description")}
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
              {t("tax.archive.eyebrow")}
            </div>
            <div className="space-y-2">
              <CardTitle className="text-3xl tracking-tight">{t("tax.archive.title")}</CardTitle>
              <CardDescription className="max-w-2xl text-sm sm:text-base">
                {t("tax.archive.description")}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        <ArchiveFiscalProfileRequired t={t} />
      </main>
    )
  }

  let detail

  try {
    if (config.workflow.fiscalSliceEnabled) {
      const workflowView = await getTaxArchivePeriodWorkflowView({
        organizationId,
        ownerScopeId: fiscalProfileAccess.profile.id,
        periodKey: decodeURIComponent(periodId),
      })
      detail = workflowView.detail
    } else {
      await syncDefaultSpanishFiscalPeriodsV1(fiscalProfileAccess.profile.id)
      detail = await getLegalArchivePeriodDetail(
        fiscalProfileAccess.profile.id,
        organizationId,
        decodeURIComponent(periodId)
      )
    }
  } catch (error) {
    if (isFiscalStorageNotReadyError(error)) {
      return (
        <main className="flex w-full max-w-5xl self-center flex-col gap-6 p-5">
          <Card className="shadow-sm">
            <CardHeader className="gap-3">
              <div className="w-fit rounded-md border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("tax.archive.eyebrow")}
              </div>
              <div className="space-y-2">
                <CardTitle className="text-3xl tracking-tight">{t("tax.archive.title")}</CardTitle>
                <CardDescription className="max-w-2xl text-sm sm:text-base">
                  {t("tax.archive.description")}
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

  if (!detail) {
    notFound()
  }

  return (
    <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <Card className="shadow-sm">
          <CardHeader className="gap-3">
            <div className="w-fit rounded-md border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("tax.archive.eyebrow")}
            </div>
            <div className="space-y-2">
              <CardTitle className="text-3xl tracking-tight">
                {t("tax.archive.detail.title", { period: detail.period.periodKey })}
              </CardTitle>
              <CardDescription className="max-w-2xl text-sm sm:text-base">
                {t("tax.archive.detail.description")}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>{detail.period.periodKey}</CardTitle>
            <CardDescription>
              {detail.period.startsOn} - {detail.period.endsOn}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/tax/archive">{t("tax.archive.detail.backToList")}</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <ArchiveManifestView detail={detail} t={t} />
    </main>
  )
}
