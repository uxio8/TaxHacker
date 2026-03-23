import { Model111ManualView } from "@/components/tax/forms/111/model-111-manual-view"
import { FiscalStorageNotReady } from "@/components/tax/fiscal-storage-not-ready"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import { createTranslator } from "@/lib/i18n"
import { requireCurrentOrganizationId } from "@/lib/tenant"
import {
  getFiscalObligationByCodeAndPeriod,
  syncFiscalObligationsForOrganization,
} from "@/models/fiscal/obligations"
import { isFiscalStorageNotReadyError } from "@/models/fiscal/storage"
import { loadModel111ManualForTenant } from "@/models/tax-forms/model-111-manual"
import Link from "next/link"

export const metadata = {
  title: "Modelo 111 manual | TaxHacker",
  description:
    "Resumen trimestral manual del Modelo 111 con evidencia externa obligatoria y sin cálculo automático.",
}

function Model111PageHeader() {
  return (
    <Card className="shadow-sm">
      <CardHeader className="gap-3">
        <div className="w-fit rounded-md border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Modelo 111
        </div>
        <div className="space-y-2">
          <CardTitle className="text-3xl tracking-tight">Modelo 111 manual</CardTitle>
          <CardDescription className="max-w-3xl text-sm sm:text-base">
            Resumen trimestral manual para retenciones del trabajo o profesionales. No está
            calculado por TaxHacker y exige soporte externo.
          </CardDescription>
        </div>
      </CardHeader>
    </Card>
  )
}

export default async function Model111Page({
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
    result = await loadModel111ManualForTenant({
      organizationId,
      userId: user.id,
      periodKey: period,
    })
  } catch (error) {
    if (isFiscalStorageNotReadyError(error)) {
      return (
        <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
          <Model111PageHeader />
          <FiscalStorageNotReady t={t} />
        </main>
      )
    }

    throw error
  }

  if (result.status === "storage_not_ready") {
    return (
      <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
        <Model111PageHeader />
        <FiscalStorageNotReady t={t} />
      </main>
    )
  }

  if (result.status === "profile_missing") {
    return (
      <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
        <Model111PageHeader />
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
    throw new Error(`Estado de carga inesperado para el Modelo 111 manual: ${result.status}`)
  }

  await syncFiscalObligationsForOrganization(organizationId)
  const obligation = await getFiscalObligationByCodeAndPeriod(
    organizationId,
    "111_manual",
    result.period.periodKey
  )

  return (
    <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
      <Model111PageHeader />
      <Model111ManualView
        t={t}
        companyName={result.profile.companyName}
        companyTaxId={result.profile.taxId}
        quarterLabel={result.period.periodKey}
        periodSelectionSource={result.period.selectionSource}
        availablePeriodKeys={result.availablePeriodKeys}
        manual={result.manual}
        obligation={obligation}
      />
    </main>
  )
}
