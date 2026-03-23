import { Model180DraftView } from "@/components/tax/forms/180/model-180-draft-view"
import { FiscalStorageNotReady } from "@/components/tax/fiscal-storage-not-ready"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import { createTranslator } from "@/lib/i18n"
import { requireCurrentOrganizationId } from "@/lib/tenant"
import { getFiscalFilingDossierByObligationId } from "@/models/fiscal/filing-dossiers"
import {
  getFiscalObligationByCodeAndPeriod,
  syncFiscalObligationsForOrganization,
} from "@/models/fiscal/obligations"
import { isFiscalStorageNotReadyError } from "@/models/fiscal/storage"
import { loadModel180DraftForTenant } from "@/models/tax-forms/model-180-loader"
import Link from "next/link"

export const metadata = {
  title: "Modelo 180 | TaxHacker",
  description: "Resumen anual de alquileres con retención derivado del núcleo trimestral del 115.",
}

function Model180PageHeader() {
  return (
    <Card className="shadow-sm">
      <CardHeader className="gap-3">
        <div className="w-fit rounded-md border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Modelo 180
        </div>
        <div className="space-y-2">
          <CardTitle className="text-3xl tracking-tight">Modelo 180</CardTitle>
          <CardDescription className="max-w-3xl text-sm sm:text-base">
            Resumen anual de alquileres con retención derivado del mismo núcleo documental del 115.
          </CardDescription>
        </div>
      </CardHeader>
    </Card>
  )
}

export default async function Model180Page({
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
    result = await loadModel180DraftForTenant({
      organizationId,
      userId: user.id,
      periodKey: period,
    })
  } catch (error) {
    if (isFiscalStorageNotReadyError(error)) {
      return (
        <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
          <Model180PageHeader />
          <FiscalStorageNotReady t={t} />
        </main>
      )
    }

    throw error
  }

  if (result.status === "storage_not_ready") {
    return (
      <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
        <Model180PageHeader />
        <FiscalStorageNotReady t={t} />
      </main>
    )
  }

  if (result.status === "profile_missing") {
    return (
      <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
        <Model180PageHeader />
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
    throw new Error(`Estado de carga inesperado para el Modelo 180: ${result.status}`)
  }

  await syncFiscalObligationsForOrganization(organizationId)
  const obligation = await getFiscalObligationByCodeAndPeriod(organizationId, "180", result.period.periodKey)
  const filingDossier = obligation
    ? await getFiscalFilingDossierByObligationId(obligation.id)
    : null

  return (
    <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
      <Model180PageHeader />
      <Model180DraftView
        companyName={result.profile.companyName}
        companyTaxId={result.profile.taxId}
        periodLabel={result.period.periodKey}
        periodSelectionSource={result.period.selectionSource}
        availablePeriodKeys={result.availablePeriodKeys}
        draft={result.draft}
        obligation={obligation}
        filingDossier={filingDossier}
      />
    </main>
  )
}
