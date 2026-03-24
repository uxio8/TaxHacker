import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { OpsDashboardSummary } from "@/models/ops"

type OpsSummaryCardsProps = {
  summary: OpsDashboardSummary
}

function SummaryCard({
  title,
  value,
  description,
}: {
  title: string
  value: number
  description: string
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-3xl font-semibold tracking-tight">{value}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

export function OpsSummaryCards({ summary }: OpsSummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <SummaryCard title="Total" value={summary.total} description="Organizaciones visibles con los filtros actuales." />
      <SummaryCard title="Trial" value={summary.trial} description="Empresas aún en periodo inicial." />
      <SummaryCard title="Past due" value={summary.pastDue} description="Requieren revisión comercial o de cobro." />
      <SummaryCard
        title="Acceso restringido"
        value={summary.restrictedOrSuspended}
        description="Empresas con acceso limitado o suspendido."
      />
      <SummaryCard title="Soporte activo" value={summary.supportActive} description="Sesiones activas ahora mismo." />
      <SummaryCard title="Con backlog de revisión" value={summary.reviewBacklog} description="Quedan documentos sin revisar." />
    </div>
  )
}
