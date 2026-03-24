import { AnnualHandoffCard } from "@/components/tax/archive/annual-handoff-card"
import { ArchiveFiscalProfileRequired } from "@/components/tax/archive/archive-fiscal-profile-required"
import { FiscalStorageNotReady } from "@/components/tax/fiscal-storage-not-ready"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import { createTranslator } from "@/lib/i18n"
import { requireCurrentOrganizationId } from "@/lib/tenant"
import { buildAnnualHandoffPack, resolveAnnualHandoffFiscalYear } from "@/models/fiscal/annual-handoff"
import { syncFiscalObligationsForOrganization } from "@/models/fiscal/obligations"
import { getFiscalProfileAccessByOrganizationId } from "@/models/fiscal/profile"
import { isFiscalStorageNotReadyError } from "@/models/fiscal/storage"

export const metadata = {
  title: "Cierre anual ligero | TaxHacker",
  description: "Paquete de handoff anual para fiscal y mercantil sin automatización contable completa.",
}

export default async function AnnualArchivePage() {
  const t = createTranslator()
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
        <ArchiveFiscalProfileRequired t={t} />
      </main>
    )
  }

  try {
    const fiscalYear = resolveAnnualHandoffFiscalYear({
      annualCloseMonth: fiscalProfileAccess.profile.annualCloseMonth,
    })
    const obligations = await syncFiscalObligationsForOrganization(organizationId)
    const pack = buildAnnualHandoffPack({
      fiscalYear,
      profile: fiscalProfileAccess.profile,
      obligations: obligations.filter((obligation) => obligation.fiscalYear === fiscalYear),
    })

    return (
      <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
        <AnnualHandoffCard pack={pack} />
      </main>
    )
  } catch (error) {
    if (isFiscalStorageNotReadyError(error)) {
      return (
        <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Cierre anual ligero</CardTitle>
              <CardDescription>
                El storage fiscal aún no está listo para construir el pack anual.
              </CardDescription>
            </CardHeader>
          </Card>
          <FiscalStorageNotReady t={t} />
        </main>
      )
    }

    throw error
  }
}
