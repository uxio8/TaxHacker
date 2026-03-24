import { Model303DraftView } from "@/components/tax/forms/303/model-303-draft-view"
import { FiscalStorageNotReady } from "@/components/tax/fiscal-storage-not-ready"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import { createPageMetadata, createTranslator } from "@/lib/i18n"
import { requireCurrentOrganizationId } from "@/lib/tenant"
import { getFiscalFilingDossierByObligationId } from "@/models/fiscal/filing-dossiers"
import {
  getFiscalObligationByCodeAndPeriod,
  syncFiscalObligationsForOrganization,
} from "@/models/fiscal/obligations"
import { getFiscalProfileAccessByOrganizationId } from "@/models/fiscal/profile"
import { isFiscalStorageNotReadyError } from "@/models/fiscal/storage"
import { loadModel303ForTenant } from "@/models/tax-forms/model-303-loader"
import Link from "next/link"

export const metadata = createPageMetadata("tax.forms.303.meta.title", {
  descriptionKey: "tax.forms.303.meta.description",
})

export default async function Model303Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const t = createTranslator()
  const params = await searchParams
  const periodParam = Array.isArray(params.period) ? params.period[0] : params.period
  const user = await getCurrentUser()
  const organizationId = await requireCurrentOrganizationId({
    getCurrentUser: async () => user,
  })
  const fiscalProfileAccess = await getFiscalProfileAccessByOrganizationId(organizationId, user.id)

  if (fiscalProfileAccess.status === "storage_not_ready") {
    return (
      <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
        <Card className="shadow-sm">
          <CardHeader className="gap-3">
            <Badge variant="secondary" className="w-fit">
              {t("tax.forms.303.eyebrow")}
            </Badge>
            <div className="space-y-2">
              <CardTitle className="text-3xl tracking-tight">{t("tax.forms.303.title")}</CardTitle>
              <CardDescription className="max-w-2xl text-sm sm:text-base">
                {t("tax.forms.303.description")}
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
      <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
        <Card className="shadow-sm">
          <CardHeader className="gap-3">
            <Badge variant="secondary" className="w-fit">
              {t("tax.forms.303.eyebrow")}
            </Badge>
            <div className="space-y-2">
              <CardTitle className="text-3xl tracking-tight">{t("tax.forms.303.title")}</CardTitle>
              <CardDescription className="max-w-2xl text-sm sm:text-base">
                {t("tax.forms.303.description")}
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

  let model303Data

  try {
    model303Data = await loadModel303ForTenant({
      ownerScopeId: fiscalProfileAccess.profile.id,
      requestedPeriodKey: typeof periodParam === "string" ? periodParam : null,
    })
  } catch (error) {
    if (isFiscalStorageNotReadyError(error)) {
      return (
        <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
          <Card className="shadow-sm">
            <CardHeader className="gap-3">
              <Badge variant="secondary" className="w-fit">
                {t("tax.forms.303.eyebrow")}
              </Badge>
              <div className="space-y-2">
                <CardTitle className="text-3xl tracking-tight">{t("tax.forms.303.title")}</CardTitle>
                <CardDescription className="max-w-2xl text-sm sm:text-base">
                  {t("tax.forms.303.description")}
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

  if (!model303Data) {
    return (
      <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
        <Card className="shadow-sm">
          <CardHeader className="gap-3">
            <Badge variant="secondary" className="w-fit">
              {t("tax.forms.303.eyebrow")}
            </Badge>
            <div className="space-y-2">
              <CardTitle className="text-3xl tracking-tight">{t("tax.forms.303.title")}</CardTitle>
              <CardDescription className="max-w-2xl text-sm sm:text-base">
                {t("tax.forms.303.description")}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Sin trimestre fiscal disponible</CardTitle>
            <CardDescription>
              Todavía no hay un trimestre abierto o solicitado con datos suficientes para preparar el
              modelo 303.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/tax/quarters">Revisar trimestres fiscales</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  await syncFiscalObligationsForOrganization(organizationId)
  const obligation = await getFiscalObligationByCodeAndPeriod(organizationId, "303", model303Data.periodKey)
  const filingDossier = obligation
    ? await getFiscalFilingDossierByObligationId(obligation.id)
    : null

  return (
    <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
      <Model303DraftView
        t={t}
        quarterLabel={model303Data.quarterLabel}
        draft={model303Data.draft}
        readiness={model303Data.readiness}
        obligation={obligation}
        filingDossier={filingDossier}
      />
    </main>
  )
}
