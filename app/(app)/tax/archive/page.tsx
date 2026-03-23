import { ArchiveFiscalProfileRequired } from "@/components/tax/archive/archive-fiscal-profile-required"
import { ArchivePeriodList } from "@/components/tax/archive/archive-period-list"
import { FiscalStorageNotReady } from "@/components/tax/fiscal-storage-not-ready"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import { createPageMetadata, createTranslator } from "@/lib/i18n"
import { requireCurrentOrganizationId } from "@/lib/tenant"
import { listLegalArchivePeriods } from "@/models/fiscal/legal-archive"
import { syncDefaultSpanishFiscalPeriodsV1 } from "@/models/fiscal/periods"
import { getFiscalProfileAccessByOrganizationId } from "@/models/fiscal/profile"
import { isFiscalStorageNotReadyError } from "@/models/fiscal/storage"
import Link from "next/link"

export const metadata = createPageMetadata("tax.archive.meta.title", {
  descriptionKey: "tax.archive.meta.description",
})

export default async function TaxArchivePage() {
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

  let periods

  try {
    await syncDefaultSpanishFiscalPeriodsV1(fiscalProfileAccess.profile.id)
    periods = await listLegalArchivePeriods(fiscalProfileAccess.profile.id, organizationId)
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

  return (
    <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
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

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>{t("tax.archive.profile.title")}</CardTitle>
            <CardDescription>{t("tax.archive.profile.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-medium">{fiscalProfileAccess.profile.companyName}</p>
              <p className="text-muted-foreground">{fiscalProfileAccess.profile.taxId}</p>
            </div>
            <p className="text-muted-foreground">{t("tax.archive.profile.scope")}</p>
            <Button asChild variant="outline" className="w-full justify-center">
              <Link href="/tax/archive/annual">Abrir cierre anual ligero</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <ArchivePeriodList periods={periods} t={t} />
    </main>
  )
}
