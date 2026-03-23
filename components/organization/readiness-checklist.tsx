import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ReadinessSummary } from "@/lib/readiness"
import Link from "next/link"

export function ReadinessChecklist({
  summary,
  title = "Puesta en marcha",
  description,
}: {
  summary: ReadinessSummary
  title?: string
  description?: string
}) {
  const pendingCount = summary.steps.filter((step) => !step.complete).length

  return (
    <Card className="shadow-sm">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={summary.isReady ? "secondary" : "outline"}>
            {summary.mode === "setup" ? "Puesta en marcha" : "Operación diaria"}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {summary.completedCount}/{summary.totalCount} listo
          </span>
        </div>
        <div className="space-y-2">
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            {description ??
              (pendingCount > 0
                ? `Faltan ${pendingCount} ajustes para dejar el tenant listo y sin puntos ciegos.`
                : "La base del tenant ya está lista para operar sin bloqueos de arranque.")}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          {summary.steps.map((step) => (
            <div key={step.key} className="rounded-lg border bg-muted/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-medium">{step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
                <Badge variant={step.complete ? "secondary" : "outline"}>{step.complete ? "Listo" : "Pendiente"}</Badge>
              </div>
              {!step.complete ? (
                <Button asChild variant="outline" size="sm" className="mt-4">
                  <Link href={step.href}>{step.actionLabel}</Link>
                </Button>
              ) : null}
            </div>
          ))}
        </div>

        {summary.nextStep ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed p-4">
            <div className="space-y-1">
              <p className="font-medium">Siguiente paso recomendado</p>
              <p className="text-sm text-muted-foreground">{summary.nextStep.description}</p>
            </div>
            <Button asChild>
              <Link href={summary.nextStep.href}>{summary.nextStep.actionLabel}</Link>
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
