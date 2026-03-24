import { CounterpartyForm } from "@/components/tax/counterparties/counterparty-form"
import { CounterpartiesTable } from "@/components/tax/counterparties/counterparties-table"
import { FiscalStorageNotReady } from "@/components/tax/fiscal-storage-not-ready"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import { createPageMetadata, createTranslator } from "@/lib/i18n"
import { requireCurrentOrganizationId } from "@/lib/tenant"
import {
  getCounterparties,
  getCounterpartyById,
  summarizeCounterpartyQuality,
} from "@/models/fiscal/counterparties"
import { getFiscalProfileAccessByOrganizationId } from "@/models/fiscal/profile"
import { isFiscalStorageNotReadyError } from "@/models/fiscal/storage"
import Link from "next/link"

export const metadata = createPageMetadata("tax.counterparties.title", {
  descriptionKey: "tax.counterparties.description",
})

type CounterpartiesPageSearchParams = {
  edit?: string
}

export default async function TaxCounterpartiesPage({
  searchParams,
}: {
  searchParams: Promise<CounterpartiesPageSearchParams>
}) {
  const t = createTranslator()
  const { edit } = await searchParams
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
            <Badge variant="secondary" className="w-fit">
              {t("common.tax")}
            </Badge>
            <div className="space-y-2">
              <CardTitle className="text-3xl tracking-tight">{t("tax.counterparties.title")}</CardTitle>
              <CardDescription className="max-w-2xl text-sm sm:text-base">
                {t("tax.counterparties.description")}
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
            <Badge variant="secondary" className="w-fit">
              {t("common.tax")}
            </Badge>
            <div className="space-y-2">
              <CardTitle className="text-3xl tracking-tight">{t("tax.counterparties.title")}</CardTitle>
              <CardDescription className="max-w-2xl text-sm sm:text-base">
                {t("tax.counterparties.description")}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>{t("tax.counterparties.setup.title")}</CardTitle>
            <CardDescription>{t("tax.counterparties.setup.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/settings/fiscal">{t("tax.counterparties.setup.action")}</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  let counterparties
  let selectedCounterparty = null

  try {
    counterparties = await getCounterparties(fiscalProfileAccess.profile.id)
    selectedCounterparty = edit
      ? await getCounterpartyById(edit, fiscalProfileAccess.profile.id)
      : null
  } catch (error) {
    if (isFiscalStorageNotReadyError(error)) {
      return (
        <main className="flex w-full max-w-5xl self-center flex-col gap-6 p-5">
          <Card className="shadow-sm">
            <CardHeader className="gap-3">
              <Badge variant="secondary" className="w-fit">
                {t("common.tax")}
              </Badge>
              <div className="space-y-2">
                <CardTitle className="text-3xl tracking-tight">{t("tax.counterparties.title")}</CardTitle>
                <CardDescription className="max-w-2xl text-sm sm:text-base">
                  {t("tax.counterparties.description")}
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

  const qualitySummary = summarizeCounterpartyQuality(counterparties)

  return (
    <main className="flex w-full max-w-6xl self-center flex-col gap-6 p-5">
      <section className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="gap-2">
            <CardDescription>Contrapartes fiables</CardDescription>
            <CardTitle className="text-3xl tracking-tight">
              {qualitySummary.reliable}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Activas y con identidad basada en NIF. Son las que mejor soportan 115, 180, 347 y 349.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="gap-2">
            <CardDescription>Necesitan NIF</CardDescription>
            <CardTitle className="text-3xl tracking-tight">
              {qualitySummary.needs_tax_id}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Siguen vivas en el maestro, pero con fallback por nombre. Conviene completarlas antes de los anuales.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="gap-2">
            <CardDescription>Inactivas</CardDescription>
            <CardTitle className="text-3xl tracking-tight">
              {qualitySummary.inactive}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No bloquean histórico, pero no deberían alimentar nuevas obligaciones sin reactivación.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <Card className="shadow-sm">
          <CardHeader className="gap-3">
            <Badge variant="secondary" className="w-fit">
              {t("common.tax")}
            </Badge>
            <div className="space-y-2">
              <CardTitle className="text-3xl tracking-tight">{t("tax.counterparties.title")}</CardTitle>
              <CardDescription className="max-w-2xl text-sm sm:text-base">
                {t("tax.counterparties.description")}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>{t("tax.counterparties.scope.title")}</CardTitle>
            <CardDescription>{t("tax.counterparties.scope.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-medium">{fiscalProfileAccess.profile.companyName}</p>
              <p className="text-muted-foreground">{fiscalProfileAccess.profile.taxId}</p>
            </div>
            <p className="text-muted-foreground">
              {t("tax.counterparties.scope.count", { count: counterparties.length.toString() })}
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(22rem,1fr)]">
        <CounterpartiesTable
          counterparties={counterparties}
          selectedCounterpartyId={selectedCounterparty?.id}
          t={t}
        />
        <CounterpartyForm counterparty={selectedCounterparty} />
      </section>
    </main>
  )
}
