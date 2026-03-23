import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function OpsOrganizationDetailLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Cargando ficha de empresa...</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Preparando contrato, miembros, salud y soporte del tenant.
        </CardContent>
      </Card>
    </div>
  )
}
