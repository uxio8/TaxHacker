import { getCurrentUser } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createPageMetadata, createTranslator } from "@/lib/i18n"
import { requireCurrentOrganizationId } from "@/lib/tenant"
import { resolveAnnualHandoffFiscalYear } from "@/models/fiscal/annual-handoff"
import { getCounterparties } from "@/models/fiscal/counterparties"
import { getFiscalProfileAccessByOrganizationId } from "@/models/fiscal/profile"
import { getModel347Gate } from "@/models/tax-forms/model-347"
import { getModel349Gate } from "@/models/tax-forms/model-349"
import Link from "next/link"

const TAX_FORM_PAGES = [
  {
    href: "/tax/forms/303",
    description: "Autoliquidación trimestral de IVA conectada al tenant real y al expediente de presentación.",
    title: "Modelo 303",
  },
  {
    href: "/tax/forms/115",
    description: "Retenciones trimestrales de alquiler derivadas del núcleo documental con trazabilidad completa.",
    title: "Modelo 115",
  },
  {
    href: "/tax/forms/111",
    description: "Resumen trimestral manual para retenciones de trabajo o profesionales con evidencia externa obligatoria.",
    title: "Modelo 111 manual",
  },
  {
    href: "/tax/forms/180",
    description: "Resumen anual de alquileres con retención reutilizando el núcleo validado del 115.",
    title: "Modelo 180",
  },
  {
    href: "/tax/forms/390",
    description: "Resumen anual de IVA consolidado desde el mismo núcleo que usa el 303.",
    title: "Modelo 390",
  },
] as const

export const metadata = createPageMetadata("tax.forms.index.meta.title", {
  descriptionKey: "tax.forms.index.meta.description",
})

export default async function TaxFormsPage() {
  const t = createTranslator()
  const user = await getCurrentUser()
  const organizationId = await requireCurrentOrganizationId({
    getCurrentUser: async () => user,
  })
  const extraAnnualCards: Array<{ href: string; description: string; title: string }> = []

  try {
    const fiscalProfileAccess = await getFiscalProfileAccessByOrganizationId(organizationId, user.id)

    if (fiscalProfileAccess.status === "ready") {
      const counterparties = await getCounterparties(fiscalProfileAccess.profile.id)
      const fiscalYear = resolveAnnualHandoffFiscalYear({
        annualCloseMonth: fiscalProfileAccess.profile.annualCloseMonth,
      })
      const model347Gate = getModel347Gate({
        fiscalYear,
        profile: fiscalProfileAccess.profile,
        counterparties,
      })

      if (model347Gate.visible) {
        extraAnnualCards.push({
          href: "/tax/forms/347",
          title: "Modelo 347",
          description: "Gate anual abierto para operaciones con terceros porque la calidad de contrapartes ya es suficiente.",
        })
      }

      const model349Gate = getModel349Gate({
        fiscalYear,
        profile: fiscalProfileAccess.profile,
        counterparties,
      })

      if (model349Gate.visible) {
        extraAnnualCards.push({
          href: "/tax/forms/349",
          title: "Modelo 349",
          description: "Gate anual abierto para operaciones intracomunitarias con perfil fiscal y terceros ya en alcance.",
        })
      }
    }
  } catch {
    // La portada de formularios debe seguir siendo navegable aunque el storage fiscal aún no esté listo.
  }

  return (
    <main className="flex w-full max-w-6xl self-center flex-col gap-6 p-5">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <Card className="shadow-sm">
          <CardHeader className="gap-3">
            <Badge variant="secondary" className="w-fit">
              {t("common.tax")}
            </Badge>
            <div className="space-y-2">
              <CardTitle className="text-3xl tracking-tight">{t("tax.forms.index.title")}</CardTitle>
              <CardDescription className="max-w-2xl text-sm sm:text-base">
                {t("tax.forms.index.description")}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>{t("tax.forms.index.scope.title")}</CardTitle>
            <CardDescription>{t("tax.forms.index.scope.description")}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>{t("tax.forms.index.scope.items")}</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {[...TAX_FORM_PAGES, ...extraAnnualCards].map((formPage) => (
          <Card key={formPage.href} className="shadow-sm">
            <CardHeader className="gap-3">
              <div className="flex items-start justify-between gap-3">
                <Badge variant="outline">{formPage.title}</Badge>
                <Badge variant="secondary">{t("tax.modules.status.available")}</Badge>
              </div>
              <div className="space-y-2">
                <CardTitle>{formPage.title}</CardTitle>
                <CardDescription>{formPage.description}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full sm:w-auto">
                <Link href={formPage.href}>{t("tax.forms.index.open")}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  )
}
