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
import Link from "next/link"

type BillingOverviewProps = {
  accessStatusLabel: string
  addons: Array<{
    code: string
    name: string
    description: string
  }>
  billingStatusLabel: string
  canOpenPortal: boolean
  currentPeriodEndsAtLabel: string | null
  limits: Array<{
    key: string
    label: string
    usageLabel: string
    limitLabel: string
  }>
  plan: {
    code: string
    name: string
    description: string
    benefits: string[]
  }
}

export function BillingOverview({
  accessStatusLabel,
  addons,
  billingStatusLabel,
  canOpenPortal,
  currentPeriodEndsAtLabel,
  limits,
  plan,
}: BillingOverviewProps) {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="shadow-sm">
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{plan.name}</Badge>
              <Badge variant="outline">{billingStatusLabel}</Badge>
              <Badge variant="secondary">{accessStatusLabel}</Badge>
            </div>
            <div className="space-y-1">
              <CardTitle>Plan actual</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 md:grid-cols-2">
              {plan.benefits.map((benefit) => (
                <div key={benefit} className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
                  {benefit}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed p-4">
              <div className="space-y-1">
                <p className="font-medium">Cliente y portal</p>
                <p className="text-sm text-muted-foreground">
                  {canOpenPortal
                    ? "La organización activa tiene customer en Stripe y puedes abrir el portal de facturación."
                    : "Todavía no hay customer de Stripe para esta organización. El CTA al portal se activará cuando exista."}
                </p>
              </div>
              {canOpenPortal ? (
                <Button asChild>
                  <Link href="/api/stripe/portal">Abrir portal</Link>
                </Button>
              ) : (
                <Button asChild variant="outline">
                  <Link href="/cloud">Ver opciones cloud</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Contrato y ciclo</CardTitle>
            <CardDescription>Resumen operativo del acceso de la organización activa.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span className="text-muted-foreground">Código de plan</span>
              <span className="font-medium">{plan.code}</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span className="text-muted-foreground">Estado billing</span>
              <span className="font-medium">{billingStatusLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span className="text-muted-foreground">Estado acceso</span>
              <span className="font-medium">{accessStatusLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span className="text-muted-foreground">Fin de periodo</span>
              <span className="font-medium">{currentPeriodEndsAtLabel || "Sin fecha"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Límites y consumo</CardTitle>
            <CardDescription>Valores efectivos tras aplicar plan base y addons activos.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Métrica</TableHead>
                  <TableHead>Uso actual</TableHead>
                  <TableHead className="text-right">Límite</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {limits.map((limit) => (
                  <TableRow key={limit.key}>
                    <TableCell className="font-medium">{limit.label}</TableCell>
                    <TableCell>{limit.usageLabel}</TableCell>
                    <TableCell className="text-right">{limit.limitLabel}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Addons activos</CardTitle>
            <CardDescription>Módulos o ampliaciones encendidos para esta organización.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {addons.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                No hay addons activos ahora mismo.
              </div>
            ) : (
              addons.map((addon) => (
                <div key={addon.code} className="rounded-xl border bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{addon.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{addon.description}</p>
                    </div>
                    <Badge variant="outline">{addon.code}</Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
