import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { FiscalObligationDetail } from "@/models/fiscal/obligations"
import type { Model349Gate } from "@/models/tax-forms/model-349"
import Link from "next/link"

export function Model349DraftView({
  periodLabel,
  gate,
  obligation,
}: {
  periodLabel: string
  gate: Model349Gate
  obligation?: FiscalObligationDetail | null
}) {
  return (
    <section className="flex flex-col gap-6">
      <Card className="shadow-sm">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">Modelo 349</Badge>
            <Badge variant={gate.visible ? "secondary" : "outline"}>
              {gate.visible ? "En alcance" : "Bloqueado"}
            </Badge>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl tracking-tight">Modelo 349</CardTitle>
            <CardDescription className="max-w-3xl text-sm sm:text-base">
              Gate anual para operaciones intracomunitarias. Solo se abre si el perfil fiscal y la
              calidad de terceros lo soportan.
            </CardDescription>
          </div>
          <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
            <p>Ejercicio {periodLabel}</p>
            <p>Estado de la obligación: {obligation?.status ?? "Pendiente"}</p>
            <p>Responsable: {obligation?.owner ?? "advisor"}</p>
          </div>
        </CardHeader>
      </Card>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Contrapartes activas" value={String(gate.quality.activeCounterpartyCount)} />
        <MetricCard label="Con VAT/NIF usable" value={String(gate.quality.withTaxIdCount)} />
        <MetricCard label="Pendientes de VAT/NIF" value={String(gate.quality.missingTaxIdCount)} />
      </section>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{gate.visible ? "Gate superado" : "Qué bloquea el 349"}</CardTitle>
          <CardDescription>
            {gate.visible
              ? "El tenant tiene señal fiscal mínima para abrir una capa posterior del 349."
              : "Sin operativa intracomunitaria declarada o sin VAT/NIF fiable, el 349 debe quedarse cerrado."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {gate.blockingReasons.length > 0 ? (
            gate.blockingReasons.map((reason) => (
              <div key={reason} className="rounded-lg border bg-muted/20 px-3 py-2">
                {reason}
              </div>
            ))
          ) : (
            <div className="rounded-lg border bg-muted/20 px-3 py-2">
              El gate está abierto. El siguiente paso será construir el flujo completo del 349 sin
              mezclarlo todavía con el core del cierre trimestral.
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="w-full sm:w-auto">
              <Link href="/settings/fiscal">Revisar perfil fiscal</Link>
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/tax/counterparties">Abrir contrapartes</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="gap-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tracking-tight">{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}
