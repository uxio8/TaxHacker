import Link from "next/link"

import { scheduleOrganizationPlanChangeFromOpsAction, setOrganizationAddonsFromOpsAction, setOrganizationPlanFromOpsAction, setOrganizationAccessOverrideFromOpsDetailAction } from "@/app/(app)/ops/organizations/[organizationId]/actions"
import { BILLING_ADDONS, BILLING_PLANS } from "@/lib/billing/catalog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type OrganizationContractCardProps = {
  organizationId: string
  contract: {
    planCode: string
    catalogVersion: number
    billingStatus: string
    accessStatus: string
    currentPeriodEndsAt: Date | null
    scheduledPlanCode: string | null
    scheduledCatalogVersion: number | null
    stripeCustomerId?: string | null
    addons: Array<{
      addonCode: string
      isActive: boolean
    }>
  } | null
  effectiveAccessStatus: string
}

function formatDateLabel(value: Date | null | undefined) {
  if (!value) {
    return "Sin fecha"
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value)
}

export function OrganizationContractCard({
  organizationId,
  contract,
  effectiveAccessStatus,
}: OrganizationContractCardProps) {
  const selectablePlans = Object.values(BILLING_PLANS).filter((plan) => plan.code !== "unlimited")
  const selectableAddons = Object.values(BILLING_ADDONS)
  const activeAddonCodes = new Set(contract?.addons.filter((addon) => addon.isActive).map((addon) => addon.addonCode) ?? [])

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Contrato y acceso</CardTitle>
        <CardDescription>Opera comercialmente la empresa sin salir del control plane.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{contract?.planCode ?? "sin contrato"}</Badge>
          <Badge variant="outline">{contract?.billingStatus ?? "trial"}</Badge>
          <Badge variant="secondary">{effectiveAccessStatus}</Badge>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">Fin de periodo</p>
            <p className="mt-1 font-medium">{formatDateLabel(contract?.currentPeriodEndsAt)}</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">Cambio programado</p>
            <p className="mt-1 font-medium">{contract?.scheduledPlanCode ?? "Sin cambios programados"}</p>
          </div>
        </div>

        <form action={setOrganizationPlanFromOpsAction} className="grid gap-3 rounded-xl border bg-muted/20 p-4 md:grid-cols-[180px_1fr_auto]">
          <input type="hidden" name="organizationId" value={organizationId} />
          <select
            name="planCode"
            defaultValue={contract?.planCode ?? "starter"}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {selectablePlans.map((plan) => (
              <option key={plan.code} value={plan.code}>
                {plan.displayName}
              </option>
            ))}
          </select>
          <Input name="reason" placeholder="Motivo del cambio inmediato" />
          <Button type="submit">Aplicar plan</Button>
        </form>

        <form action={setOrganizationAddonsFromOpsAction} className="space-y-3 rounded-xl border bg-muted/20 p-4">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="fallbackPlanCode" value={contract?.planCode ?? "starter"} />
          <div className="grid gap-3 md:grid-cols-2">
            {selectableAddons.map((addon) => (
              <label key={addon.code} className="flex items-start gap-3 rounded-lg border bg-background p-3 text-sm">
                <input
                  type="checkbox"
                  name="addonCodes"
                  value={addon.code}
                  defaultChecked={activeAddonCodes.has(addon.code)}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium">{addon.displayName}</span>
                  <span className="mt-1 block text-muted-foreground">{addon.description}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Input name="reason" placeholder="Motivo del cambio de addons" className="max-w-md" />
            <Button type="submit" variant="outline">
              Guardar addons
            </Button>
          </div>
        </form>

        <form action={scheduleOrganizationPlanChangeFromOpsAction} className="grid gap-3 rounded-xl border bg-muted/20 p-4 md:grid-cols-[180px_1fr_auto]">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="fallbackPlanCode" value={contract?.planCode ?? "starter"} />
          <select
            name="scheduledPlanCode"
            defaultValue={contract?.scheduledPlanCode ?? ""}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Sin cambio programado</option>
            {selectablePlans.map((plan) => (
              <option key={plan.code} value={plan.code}>
                {plan.displayName}
              </option>
            ))}
          </select>
          <Input name="reason" placeholder="Motivo del cambio al cierre de ciclo" />
          <Button type="submit" variant="secondary">
            Programar
          </Button>
        </form>

        <form action={setOrganizationAccessOverrideFromOpsDetailAction} className="grid gap-3 rounded-xl border border-dashed p-4 md:grid-cols-[180px_1fr_auto]">
          <input type="hidden" name="organizationId" value={organizationId} />
          <select
            name="accessStatus"
            defaultValue=""
            className="flex h-9 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Acceso por contrato</option>
            <option value="restricted">Restringir</option>
            <option value="suspended">Suspender</option>
          </select>
          <Input name="reason" placeholder="Motivo del override de acceso" />
          <Button type="submit" variant="ghost">
            Guardar acceso
          </Button>
        </form>

        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          {contract?.stripeCustomerId ? (
            <span>La organización ya tiene customer en Stripe. Si necesitas autoservicio, usa el portal desde <Link href="/settings/billing" className="underline underline-offset-4">billing</Link>.</span>
          ) : (
            <span>La empresa todavía no tiene customer de Stripe asociado. Los cambios aquí operan el contrato interno.</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
