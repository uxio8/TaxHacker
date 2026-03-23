import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

type ObligationBadgeVariant = "default" | "secondary" | "outline"

export type ObligationStatusCardItem = {
  code: string
  title: string
  periodLabel: string
  href: string
  statusLabel: string
  statusVariant: ObligationBadgeVariant
  dueDateLabel: string
  readinessLabel: string
  readinessVariant: ObligationBadgeVariant
  blockingItems: string[]
  responsibleLabel: string
  nextActionLabel: string
  nextActionHref: string
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}

export function ObligationStatusCard({ obligation }: { obligation: ObligationStatusCardItem }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">{obligation.code}</Badge>
          <Badge variant={obligation.statusVariant}>{obligation.statusLabel}</Badge>
          <Badge variant={obligation.readinessVariant}>{obligation.readinessLabel}</Badge>
        </div>
        <div className="space-y-1">
          <CardTitle className="text-xl tracking-tight">{obligation.title}</CardTitle>
          <p className="text-sm text-muted-foreground">Periodo {obligation.periodLabel}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <DetailItem label="Vencimiento" value={obligation.dueDateLabel} />
          <DetailItem label="Readiness" value={obligation.readinessLabel} />
          <DetailItem label="Responsable" value={obligation.responsibleLabel} />
          <DetailItem label="Siguiente acción" value={obligation.nextActionLabel} />
        </div>

        <div className="rounded-lg border bg-muted/20 px-3 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bloqueos</p>
          <div className="mt-2 space-y-1">
            {obligation.blockingItems.map((item) => (
              <p key={item} className="text-sm text-foreground">
                {item}
              </p>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href={obligation.href}>Abrir obligación</Link>
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link href={obligation.nextActionHref}>{obligation.nextActionLabel}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
