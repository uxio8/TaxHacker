import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type OrganizationAuditCardProps = {
  recentLogs: Array<{
    id: string
    action: string
    reason: string | null
    createdAt: Date
  }>
  recentBillingEvents: Array<{
    id: string
    eventType: string
    externalEventId: string | null
    processedAt: Date | null
    createdAt: Date
  }>
}

function formatDateLabel(value: Date | null | undefined) {
  if (!value) {
    return "Sin fecha"
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value)
}

export function OrganizationAuditCard({
  recentLogs,
  recentBillingEvents,
}: OrganizationAuditCardProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Auditoría y eventos</CardTitle>
        <CardDescription>Últimas acciones sensibles y eventos de billing del tenant.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <p className="font-medium">Auditoría de plataforma</p>
          {recentLogs.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              Sin eventos auditados recientes.
            </div>
          ) : (
            recentLogs.map((row) => (
              <div key={row.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{row.action}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{row.reason || "Sin motivo explícito"}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDateLabel(row.createdAt)}</p>
              </div>
            ))
          )}
        </div>

        <div className="space-y-3">
          <p className="font-medium">Eventos de billing</p>
          {recentBillingEvents.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              Sin webhooks ni eventos recientes.
            </div>
          ) : (
            recentBillingEvents.map((row) => (
              <div key={row.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{row.eventType}</Badge>
                  {row.externalEventId ? <Badge variant="secondary">{row.externalEventId}</Badge> : null}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Creado {formatDateLabel(row.createdAt)} · procesado {formatDateLabel(row.processedAt)}
                </p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
