import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

type AnnualOverviewBadgeVariant = "default" | "secondary" | "outline"

export type AnnualFiscalOverviewItem = {
  code: string
  title: string
  description: string
  href: string
  dueDateLabel: string
  statusLabel: string
  statusVariant: AnnualOverviewBadgeVariant
  responsibleLabel: string
  nextActionLabel: string
  nextActionHref: string
  operationalNote: string
}

export type AnnualFiscalOverview = {
  fiscalYear: number
  items: AnnualFiscalOverviewItem[]
  handoffHref: string
  handoffSummary: string
}

export function AnnualFiscalOverviewCard({ annualOverview }: { annualOverview?: AnnualFiscalOverview }) {
  if (!annualOverview || annualOverview.items.length === 0) {
    return null
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">Capa anual</Badge>
          <Badge variant="outline">Ejercicio {annualOverview.fiscalYear}</Badge>
        </div>
        <CardTitle>Obligaciones y handoff anual</CardTitle>
        <CardDescription>
          Resumen de modelos anuales y del expediente de cierre para que el trabajo fiscal no se
          corte al salir del trimestre.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          {annualOverview.items.map((item) => (
            <article key={item.code} className="rounded-lg border bg-muted/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{item.code}</Badge>
                    <Badge variant={item.statusVariant}>{item.statusLabel}</Badge>
                  </div>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p className="text-xs uppercase tracking-wide">Vencimiento</p>
                  <p className="font-medium text-foreground">{item.dueDateLabel}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-lg border bg-background/60 px-3 py-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Vencimiento
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{item.dueDateLabel}</p>
                </div>
                <div className="rounded-lg border bg-background/60 px-3 py-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Responsable
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{item.responsibleLabel}</p>
                </div>
                <div className="rounded-lg border bg-background/60 px-3 py-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Siguiente acción
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{item.nextActionLabel}</p>
                </div>
              </div>
              <div className="mt-4 rounded-lg border bg-background/60 px-3 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Señal operativa
                </p>
                <p className="mt-2 text-sm text-foreground">{item.operationalNote}</p>
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link href={item.href}>Abrir obligación</Link>
                </Button>
                <Button asChild className="w-full sm:w-auto">
                  <Link href={item.nextActionHref}>{item.nextActionLabel}</Link>
                </Button>
              </div>
            </article>
          ))}
        </div>

        <div className="rounded-lg border bg-muted/20 p-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Cierre anual ligero
            </p>
            <p className="text-sm text-foreground">{annualOverview.handoffSummary}</p>
          </div>
          <Button asChild className="mt-4 w-full sm:w-auto">
            <Link href={annualOverview.handoffHref}>Abrir handoff anual</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
