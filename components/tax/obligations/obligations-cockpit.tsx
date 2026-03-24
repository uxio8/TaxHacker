import {
  ObligationStatusCard,
  type ObligationStatusCardItem,
} from "@/components/tax/obligations/obligation-status-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export type ObligationCockpitItem = ObligationStatusCardItem

export function ObligationsCockpit({ obligations }: { obligations: ObligationCockpitItem[] }) {
  if (obligations.length === 0) {
    return null
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="gap-2">
        <CardTitle>Cockpit de obligaciones</CardTitle>
        <CardDescription>
          Seguimiento operativo de cada obligación recurrente del trimestre, sin salir del hub fiscal.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-2">
        {obligations.map((obligation) => (
          <ObligationStatusCard key={`${obligation.code}-${obligation.periodLabel}`} obligation={obligation} />
        ))}
      </CardContent>
    </Card>
  )
}
