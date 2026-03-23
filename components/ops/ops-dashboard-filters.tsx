import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type OpsDashboardFiltersProps = {
  q: string
  planCode: string
  billingStatus: string
  accessStatus: string
  support: string
  backlog: string
}

export function OpsDashboardFilters({
  q,
  planCode,
  billingStatus,
  accessStatus,
  support,
  backlog,
}: OpsDashboardFiltersProps) {
  return (
    <form action="/ops" className="flex flex-wrap gap-3">
      <Input name="q" defaultValue={q} placeholder="Buscar empresa o email de miembro" className="max-w-sm" />
      <select
        name="planCode"
        defaultValue={planCode}
        className="flex h-9 rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="">Todos los planes</option>
        <option value="early">Early</option>
        <option value="starter">Starter</option>
        <option value="pro">Pro</option>
      </select>
      <select
        name="billingStatus"
        defaultValue={billingStatus}
        className="flex h-9 rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="">Todo billing</option>
        <option value="trial">Trial</option>
        <option value="active">Activo</option>
        <option value="past_due">Past due</option>
        <option value="cancelled">Cancelado</option>
      </select>
      <select
        name="accessStatus"
        defaultValue={accessStatus}
        className="flex h-9 rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="">Todo acceso</option>
        <option value="enabled">Habilitado</option>
        <option value="grace_period">Gracia</option>
        <option value="restricted">Restringido</option>
        <option value="suspended">Suspendido</option>
      </select>
      <select
        name="support"
        defaultValue={support}
        className="flex h-9 rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="">Todo soporte</option>
        <option value="active">Con soporte activo</option>
      </select>
      <select
        name="backlog"
        defaultValue={backlog}
        className="flex h-9 rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="">Todo backlog</option>
        <option value="with_backlog">Con revisión pendiente</option>
      </select>
      <Button type="submit" variant="outline">
        Filtrar
      </Button>
    </form>
  )
}
