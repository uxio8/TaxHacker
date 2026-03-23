import { Model349DraftView } from "@/components/tax/forms/349/model-349-draft-view"
import { FiscalStorageNotReady } from "@/components/tax/fiscal-storage-not-ready"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import { createTranslator } from "@/lib/i18n"
import { requireCurrentOrganizationId } from "@/lib/tenant"
import { getCounterparties } from "@/models/fiscal/counterparties"
import { getFiscalObligationByCodeAndPeriod, syncFiscalObligationsForOrganization } from "@/models/fiscal/obligations"
import { getFiscalProfileAccessByOrganizationId } from "@/models/fiscal/profile"
import { isFiscalStorageNotReadyError } from "@/models/fiscal/storage"
import { resolveAnnualHandoffFiscalYear } from "@/models/fiscal/annual-handoff"
import { getModel349Gate } from "@/models/tax-forms/model-349"
import Link from "next/link"

export const metadata = {
  title: "Modelo 349 | TaxHacker",
  description: "Gate anual para operaciones intracomunitarias basado en perfil fiscal y calidad de terceros.",
}

function parsePeriodKey(periodKey?: string) {
  if (!periodKey) return null
  const match = /^(\d{4})-Y$/.exec(periodKey)
  return match ? Number.parseInt(match[1] ?? "", 10) : null
}

export default async function Model349Page({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const t = createTranslator()
  const { period } = await searchParams
  const user = await getCurrentUser()
  const organizationId = await requireCurrentOrganizationId({
    getCurrentUser: async () => user,
  })
  const fiscalProfileAccess = await getFiscalProfileAccessByOrganizationId(organizationId, user.id)

  if (fiscalProfileAccess.status === "storage_not_ready") {
    return (
      <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
        <FiscalStorageNotReady t={t} />
      </main>
    )
  }

  if (fiscalProfileAccess.status !== "ready") {
    return (
      <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
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

  try {
    const counterparties = await getCounterparties(fiscalProfileAccess.profile.id)
    const fiscalYear =
      parsePeriodKey(period) ??
      resolveAnnualHandoffFiscalYear({
        annualCloseMonth: fiscalProfileAccess.profile.annualCloseMonth,
      })

    await syncFiscalObligationsForOrganization(organizationId)
    const obligation = await getFiscalObligationByCodeAndPeriod(organizationId, "349", `${fiscalYear}-Y`)
    const gate = getModel349Gate({
      fiscalYear,
      profile: fiscalProfileAccess.profile,
      counterparties,
    })

    return (
      <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
        <Model349DraftView periodLabel={`${fiscalYear}-Y`} gate={gate} obligation={obligation} />
      </main>
    )
  } catch (error) {
    if (isFiscalStorageNotReadyError(error)) {
      return (
        <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
          <FiscalStorageNotReady t={t} />
        </main>
      )
    }

    throw error
  }
}
