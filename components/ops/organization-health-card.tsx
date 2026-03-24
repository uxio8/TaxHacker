import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { OpsOrganizationHealthSummary } from "@/models/ops-organization-detail"

type OrganizationHealthCardProps = {
  health: OpsOrganizationHealthSummary
}

function toneLabel(tone: OpsOrganizationHealthSummary["statusTone"]) {
  if (tone === "critical") {
    return "Crítico"
  }

  if (tone === "warning") {
    return "Requiere atención"
  }

  return "Sano"
}

export function OrganizationHealthCard({ health }: OrganizationHealthCardProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Salud y readiness</CardTitle>
        <CardDescription>Diagnóstico rápido antes de entrar a otras pantallas del tenant.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={health.statusTone === "critical" ? "destructive" : "outline"}>{toneLabel(health.statusTone)}</Badge>
          <Badge variant="secondary">{health.counters.blocked} bloqueos</Badge>
          <Badge variant="secondary">{health.counters.needsAction} acciones</Badge>
          <Badge variant="secondary">{health.counters.supportSessions} soporte activo</Badge>
          <Badge variant="secondary">{health.counters.openInvitations} invitaciones</Badge>
        </div>

        {health.blockers.length === 0 ? (
          <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            La empresa no tiene bloqueos operativos visibles desde el control plane.
          </div>
        ) : (
          <div className="space-y-3">
            {health.blockers.map((blocker) => (
              <div key={`${blocker.kind}-${blocker.title}`} className="rounded-xl border p-4">
                <p className="font-medium">{blocker.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">Tipo: {blocker.kind}</p>
                {blocker.href ? (
                  <Link href={blocker.href} className="mt-2 inline-block text-sm font-medium text-primary underline underline-offset-4">
                    Abrir superficie
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
