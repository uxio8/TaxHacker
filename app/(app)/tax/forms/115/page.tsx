import { Model115DraftView } from "@/components/tax/forms/115/model-115-draft-view"
import { FiscalStorageNotReady } from "@/components/tax/fiscal-storage-not-ready"
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
import { isFiscalStorageNotReadyError } from "@/models/fiscal/storage"
import { loadModel115DraftForTenant } from "@/models/tax-forms/model-115-loader"
import Link from "next/link"

export const metadata = createPageMetadata("tax.forms.115.meta.title", {
  descriptionKey: "tax.forms.115.meta.description",
})

function Model115PageHeader({ t }: { t: ReturnType<typeof createTranslator> }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="gap-3">
        <div className="w-fit rounded-md border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("tax.forms.115.eyebrow")}
        </div>
        <div className="space-y-2">
          <CardTitle className="text-3xl tracking-tight">{t("tax.forms.115.title")}</CardTitle>
          <CardDescription className="max-w-3xl text-sm sm:text-base">
            {t("tax.forms.115.description")}
          </CardDescription>
        </div>
      </CardHeader>
    </Card>
  )
}

export default async function Model115Page({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const t = createTranslator()
  const user = await getCurrentUser()
  const organizationId = await requireCurrentOrganizationId({
    getCurrentUser: async () => user,
  })
  const { period } = await searchParams

  let result

  try {
    result = await loadModel115DraftForTenant({
      organizationId,
      userId: user.id,
      periodKey: period,
    })
  } catch (error) {
    if (isFiscalStorageNotReadyError(error)) {
      return (
        <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
          <Model115PageHeader t={t} />
          <FiscalStorageNotReady t={t} />
        </main>
      )
    }

    throw error
  }

  if (result.status === "storage_not_ready") {
    return (
      <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
        <Model115PageHeader t={t} />
        <FiscalStorageNotReady t={t} />
      </main>
    )
  }

  if (result.status === "profile_missing") {
    return (
      <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
        <Model115PageHeader t={t} />
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

  if (result.status !== "ready") {
    throw new Error(`Estado de carga inesperado para el Modelo 115: ${result.status}`)
  }

  await syncFiscalObligationsForOrganization(organizationId)
  const obligation = await getFiscalObligationByCodeAndPeriod(organizationId, "115", result.period.periodKey)
  const filingDossier = obligation
    ? await getFiscalFilingDossierByObligationId(obligation.id)
    : null

  return (
    <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
      <Model115PageHeader t={t} />
      <Model115DraftView
        t={t}
        companyName={result.profile.companyName}
        companyTaxId={result.profile.taxId}
        quarterLabel={result.period.periodKey}
        periodSelectionSource={result.period.selectionSource}
        availablePeriodKeys={result.availablePeriodKeys}
        draft={result.draft}
        obligation={obligation}
        filingDossier={filingDossier}
      />
    </main>
  )
}
