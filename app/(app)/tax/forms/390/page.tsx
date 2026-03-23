import { Model390DraftView } from "@/components/tax/forms/390/model-390-draft-view"
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
import { loadModel390DraftForTenant } from "@/models/tax-forms/model-390-loader"
import Link from "next/link"

export const metadata = {
  title: "Modelo 390 | TaxHacker",
  description: "Resumen anual del IVA consolidado sobre el mismo núcleo del Modelo 303.",
}

function Model390PageHeader() {
  return (
    <Card className="shadow-sm">
      <CardHeader className="gap-3">
        <div className="w-fit rounded-md border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Modelo 390
        </div>
        <div className="space-y-2">
          <CardTitle className="text-3xl tracking-tight">Modelo 390</CardTitle>
          <CardDescription className="max-w-3xl text-sm sm:text-base">
            Resumen anual de IVA derivado del mismo núcleo documental y de cálculo que usa el 303.
          </CardDescription>
        </div>
      </CardHeader>
    </Card>
  )
}

export default async function Model390Page({
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
    result = await loadModel390DraftForTenant({
      organizationId,
      userId: user.id,
      periodKey: period,
    })
  } catch (error) {
    if (isFiscalStorageNotReadyError(error)) {
      return (
        <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
          <Model390PageHeader />
          <FiscalStorageNotReady t={t} />
        </main>
      )
    }

    throw error
  }

  if (result.status === "storage_not_ready") {
    return (
      <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
        <Model390PageHeader />
        <FiscalStorageNotReady t={t} />
      </main>
    )
  }

  if (result.status === "profile_missing") {
    return (
      <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
        <Model390PageHeader />
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
    throw new Error(`Estado de carga inesperado para el Modelo 390: ${result.status}`)
  }

  await syncFiscalObligationsForOrganization(organizationId)
  const obligation = await getFiscalObligationByCodeAndPeriod(organizationId, "390", result.period.periodKey)
  const filingDossier = obligation
    ? await getFiscalFilingDossierByObligationId(obligation.id)
    : null

  return (
    <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
      <Model390PageHeader />
      <Model390DraftView
        companyName={result.profile.companyName}
        companyTaxId={result.profile.taxId}
        periodLabel={result.period.periodKey}
        periodSelectionSource={result.period.selectionSource}
        availablePeriodKeys={result.availablePeriodKeys}
        draft={result.draft}
        readiness={result.readiness}
        obligation={obligation}
        filingDossier={filingDossier}
      />
    </main>
  )
}
