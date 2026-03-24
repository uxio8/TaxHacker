import { AnnualHandoffItemForm } from "@/components/tax/archive/annual-handoff-item-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { AnnualHandoffPack } from "@/models/fiscal/annual-handoff"
import Link from "next/link"

function getStatusLabel(status: string) {
  if (status === "waiting_on_documents") return "Esperando documentación"
  if (status === "needs_review") return "Requiere revisión"
  if (status === "ready_to_prepare") return "Listo para preparar"
  if (status === "draft_ready") return "Listo"
  if (status === "ready_to_file") return "Listo para presentar"
  if (status === "filed") return "Presentado"
  if (status === "archived") return "Archivado"
  if (status === "not_applicable") return "No aplica"
  return "Pendiente"
}

function getOwnerLabel(owner: string) {
  if (owner === "client") return "Cliente"
  if (owner === "shared") return "Cliente / Asesoría"
  if (owner === "system") return "Sistema"
  return "Asesoría"
}

export function AnnualHandoffCard({ pack }: { pack: AnnualHandoffPack }) {
  return (
    <section className="flex flex-col gap-6">
      <Card className="shadow-sm">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">Annual handoff</Badge>
            <Badge variant="outline">Sin automatización contable</Badge>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl tracking-tight">Cierre anual ligero</CardTitle>
            <CardDescription className="max-w-3xl text-sm sm:text-base">
              Seguimiento anual de fiscal y mercantil para dejar el expediente preparado antes del
              handoff a contabilidad o asesoría externa.
            </CardDescription>
          </div>
          <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
            <p>Ejercicio {pack.periodKey}</p>
            <p>
              Empresa: <span className="font-medium text-foreground">{pack.companyName}</span>
            </p>
            <p>
              NIF: <span className="font-medium text-foreground">{pack.taxId}</span>
            </p>
          </div>
        </CardHeader>
      </Card>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Items anuales" value={String(pack.summary.totalItems)} />
        <MetricCard label="Listos o presentados" value={String(pack.summary.readyOrFiledItems)} />
        <MetricCard label="Con bloqueos" value={String(pack.summary.blockedItems)} />
      </section>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Checklist anual</CardTitle>
          <CardDescription>
            Vista única del handoff fiscal y mercantil sin vender automatización de cuentas anuales
            ni de Impuesto sobre Sociedades.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ítem</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Evidencias</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pack.items.map((item) => (
                <TableRow key={item.code}>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.notes}</p>
                    </div>
                  </TableCell>
                  <TableCell>{item.kind === "tax" ? "Fiscal" : "Mercantil"}</TableCell>
                  <TableCell>{getStatusLabel(item.status)}</TableCell>
                  <TableCell>{getOwnerLabel(item.owner)}</TableCell>
                  <TableCell>{item.dueDate}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {item.requiredEvidence.map((evidence) => (
                        <Badge key={`${item.code}-${evidence}`} variant="outline">
                          {evidence}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Seguimiento manual</CardTitle>
          <CardDescription>
            Ajusta estado, responsable y notas por ítem anual sin salir del handoff. La tabla de
            arriba queda como resumen y este bloque como superficie operativa.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          {pack.items.map((item) => (
            <article key={`tracking-${item.code}`} className="rounded-xl border bg-muted/10 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{item.code}</Badge>
                <Badge variant="outline">{item.kind === "tax" ? "Fiscal" : "Mercantil"}</Badge>
              </div>
              <div className="mt-3 space-y-1">
                <p className="font-semibold">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.notes}</p>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <SummaryItem label="Estado actual" value={getStatusLabel(item.status)} />
                <SummaryItem label="Responsable" value={getOwnerLabel(item.owner)} />
                <SummaryItem label="Vencimiento" value={item.dueDate} />
              </div>

              <div className="mt-4 rounded-xl border bg-background/60 p-3 text-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Bloqueos
                </p>
                <div className="mt-2 space-y-1">
                  {item.blockingReasons.length > 0 ? (
                    item.blockingReasons.map((reason) => (
                      <p key={`${item.code}-${reason}`} className="text-foreground">
                        {reason}
                      </p>
                    ))
                  ) : (
                    <p className="text-foreground">Sin bloqueos activos.</p>
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-xl border bg-background/60 p-3 text-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Contexto guardado
                </p>
                <p className="mt-2 text-foreground">
                  {item.trackingNotes ?? "Aún no hay notas internas para este ítem anual."}
                </p>
              </div>

              <div className="mt-4">
                <AnnualHandoffItemForm
                  code={item.code}
                  periodKey={pack.periodKey}
                  defaultStatus={item.status}
                  defaultOwner={item.owner}
                  defaultNotes={item.trackingNotes ?? ""}
                />
              </div>
            </article>
          ))}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Siguiente paso</CardTitle>
          <CardDescription>
            Usa este pack anual como handoff y expediente de seguimiento, no como motor contable.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button asChild className="w-full sm:w-auto">
            <Link href="/tax/archive">Volver al archivo</Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/tax/forms">Abrir formularios</Link>
          </Button>
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

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}
