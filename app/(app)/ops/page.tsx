import { CreateOrganizationForm } from "@/components/ops/create-organization-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { OpsDashboardFilters } from "@/components/ops/ops-dashboard-filters"
import { OpsSummaryCards } from "@/components/ops/ops-summary-cards"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { createPageMetadata } from "@/lib/i18n"
import { getCurrentUser } from "@/lib/auth"
import { formatBytes, formatNumber } from "@/lib/utils"
import { listRecentPlatformAuditLogs } from "@/models/platform-audit"
import { canAccessPlatformOps } from "@/models/platform-admins"
import { listOrganizationsForOps, summarizeOrganizationsForOps } from "@/models/ops"
import { listSupportAccessSessions } from "@/models/support-access"
import { redirect } from "next/navigation"
import Link from "next/link"

import {
  createSupportAccessSessionAction,
  revokeSupportAccessSessionAction,
  setOrganizationAccessOverrideAction,
  startImpersonationAction,
} from "./actions"

export const metadata = createPageMetadata("common.settings")

type OpsOrganizationRow = Awaited<ReturnType<typeof listOrganizationsForOps>>[number]
type SupportSessionRow = Awaited<ReturnType<typeof listSupportAccessSessions>>[number]
type AuditRow = Awaited<ReturnType<typeof listRecentPlatformAuditLogs>>[number]

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

function formatStatusLabel(value: string) {
  switch (value) {
    case "trial":
      return "Prueba"
    case "active":
      return "Activo"
    case "past_due":
      return "Pendiente"
    case "cancelled":
      return "Cancelado"
    case "archived":
      return "Archivado"
    case "enabled":
      return "Habilitado"
    case "grace_period":
      return "Gracia"
    case "restricted":
      return "Restringido"
    case "suspended":
      return "Suspendido"
    default:
      return value
  }
}

export default async function OpsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; planCode?: string; billingStatus?: string; accessStatus?: string; support?: string; backlog?: string }>
}) {
  const user = await getCurrentUser()
  const allowed = await canAccessPlatformOps(user.id)

  if (!allowed) {
    redirect("/dashboard")
  }

  const { q = "", planCode = "", billingStatus = "", accessStatus = "", support = "", backlog = "" } = await searchParams

  const [organizations, supportSessions, auditRows] = await Promise.all([
    listOrganizationsForOps({
      search: q,
      planCode,
      billingStatus,
      accessStatus,
      support: support === "active" ? "active" : "all",
      backlog: backlog === "with_backlog" ? "with_backlog" : "all",
    }),
    listSupportAccessSessions({ activeOnly: true, limit: 20 }),
    listRecentPlatformAuditLogs({ limit: 20 }),
  ])
  const summary = summarizeOrganizationsForOps(organizations)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Control plane</CardTitle>
          <CardDescription>
            Operación global del SaaS: empresas, contrato efectivo, consumo y soporte temporal auditado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Filtros operativos</p>
              <OpsDashboardFilters
                q={q}
                planCode={planCode}
                billingStatus={billingStatus}
                accessStatus={accessStatus}
                support={support}
                backlog={backlog}
              />
            </div>
            <CreateOrganizationForm />
          </div>
        </CardContent>
      </Card>

      <OpsSummaryCards summary={summary} />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Empresas</CardTitle>
          <CardDescription>Vista rápida de estado comercial, acceso y soporte.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Miembros</TableHead>
                <TableHead>Storage</TableHead>
                <TableHead>Soporte</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.map((organization: OpsOrganizationRow) => {
                const storageUsage =
                  organization.usageRecords.find((row) => row.metricKey === "storage.bytes")?.quantity ?? 0

                return (
                  <TableRow key={organization.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <Link
                          href={`/ops/organizations/${organization.id}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {organization.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          Alta {formatDateLabel(organization.createdAt)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant="outline">{organization.subscription?.planCode ?? "sin contrato"}</Badge>
                        {organization.activeAddonCodes.length ? (
                          <p className="text-xs text-muted-foreground">
                            {organization.activeAddonCodes.join(", ")}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge>{formatStatusLabel(organization.subscription?.billingStatus ?? "trial")}</Badge>
                        <Badge variant="secondary">
                          {formatStatusLabel(organization.effectiveAccessStatus)}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">{formatNumber(organization.memberships.length)}</p>
                        {organization.hasUnsortedBacklog ? (
                          <p className="text-xs text-muted-foreground">Hay revisión pendiente</p>
                        ) : null}
                        {organization.memberships.length > 0 ? (
                          <form action={startImpersonationAction} className="flex flex-wrap gap-2">
                            <input type="hidden" name="organizationId" value={organization.id} />
                            <input type="hidden" name="returnTo" value={`/ops/organizations/${organization.id}`} />
                            <select
                              name="assumedUserId"
                              defaultValue={organization.memberships[0]?.userId ?? ""}
                              className="flex h-8 min-w-40 rounded-md border border-input bg-background px-2 text-xs"
                            >
                              {organization.memberships.map((membership) => (
                                <option key={membership.id} value={membership.userId}>
                                  {(membership.user?.name || membership.user?.email || membership.userId)} · {membership.role}
                                </option>
                              ))}
                            </select>
                            <select
                              name="mode"
                              defaultValue="read_write"
                              className="flex h-8 rounded-md border border-input bg-background px-2 text-xs"
                            >
                              <option value="read_write">Escritura</option>
                              <option value="read_only">Lectura</option>
                            </select>
                            <Input
                              name="reason"
                              required
                              placeholder="Motivo de impersonación"
                              className="h-8 min-w-44 text-xs"
                            />
                            <Button type="submit" size="sm" variant="secondary">
                              Entrar como
                            </Button>
                          </form>
                        ) : null}
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/ops/organizations/${organization.id}`}>Abrir ficha</Link>
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>{formatBytes(storageUsage)}</TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <form action={createSupportAccessSessionAction} className="flex flex-wrap gap-2">
                          <input type="hidden" name="organizationId" value={organization.id} />
                          <input type="hidden" name="mode" value="read" />
                          <input type="hidden" name="durationHours" value="2" />
                          <Input
                            name="reason"
                            required
                            placeholder="Motivo de soporte"
                            className="h-8 min-w-56 text-xs"
                          />
                          <Button type="submit" size="sm" variant="outline">
                            Abrir soporte
                          </Button>
                        </form>
                        <form action={setOrganizationAccessOverrideAction} className="flex flex-wrap gap-2">
                          <input type="hidden" name="organizationId" value={organization.id} />
                          <select
                            name="accessStatus"
                            defaultValue=""
                            className="flex h-8 rounded-md border border-input bg-background px-2 text-xs"
                          >
                            <option value="">Acceso por contrato</option>
                            <option value="restricted">Restringir</option>
                            <option value="suspended">Suspender</option>
                          </select>
                          <Input
                            name="reason"
                            required
                            placeholder="Motivo operativo"
                            className="h-8 min-w-40 text-xs"
                          />
                          <Button type="submit" size="sm" variant="ghost">
                            Aplicar
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Sesiones de soporte activas</CardTitle>
            <CardDescription>Accesos temporales vigentes y revocables.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {supportSessions.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                No hay sesiones activas ahora mismo.
              </div>
            ) : (
              supportSessions.map((session: SupportSessionRow) => (
                <div key={session.id} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">{session.organization?.name ?? session.organizationId}</p>
                      <p className="text-sm text-muted-foreground">
                        {session.user?.name || session.user?.email || session.userId} · {session.mode}
                      </p>
                      {session.assumedUser ? (
                        <p className="text-sm text-muted-foreground">
                          Actuando como {session.assumedUser.name || session.assumedUser.email || session.assumedUser.id}
                        </p>
                      ) : null}
                      <p className="text-sm text-muted-foreground">{session.reason}</p>
                      <p className="text-xs text-muted-foreground">Caduca {formatDateLabel(session.expiresAt)}</p>
                    </div>
                    <form action={revokeSupportAccessSessionAction}>
                      <input type="hidden" name="sessionId" value={session.id} />
                      <input type="hidden" name="organizationId" value={session.organizationId} />
                      <Button type="submit" variant="ghost" size="sm">
                        Revocar
                      </Button>
                    </form>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Auditoría reciente</CardTitle>
            <CardDescription>Últimas acciones sensibles del control plane.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {auditRows.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                Todavía no hay eventos auditados.
              </div>
            ) : (
              auditRows.map((row: AuditRow) => (
                <div key={row.id} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{row.action}</Badge>
                    {row.organizationId ? <Badge variant="secondary">{row.organizationId}</Badge> : null}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{row.reason || "Sin motivo explícito"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Registrado {formatDateLabel(row.createdAt)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
