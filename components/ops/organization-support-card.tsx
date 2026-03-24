import {
  createSupportAccessSessionFromOpsDetailAction,
  revokeSupportAccessSessionFromOpsDetailAction,
} from "@/app/(app)/ops/organizations/[organizationId]/actions"
import { startImpersonationAction, startOwnerImpersonationAction } from "@/app/(app)/ops/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { MEMBERSHIP_ROLE } from "@/lib/membership-roles"

type OrganizationSupportCardProps = {
  organizationId: string
  members: Array<{
    userId: string
    role: string
    user: {
      id: string
      email: string | null
      name: string | null
    } | null
  }>
  support: {
    activeSessions: Array<{
      id: string
      userId: string
      mode: string
      reason: string
      expiresAt: Date
      user?: {
        name: string | null
        email: string | null
      } | null
      assumedUser?: {
        id: string
        name: string | null
        email: string | null
      } | null
    }>
    timeline: Array<{
      id: string
      kind: "session" | "audit"
      occurredAt: Date
      title: string
      description: string
    }>
    guardrails: {
      defaultDurationHours: number
      maxDurationHours: number
      actorAlwaysVisible: boolean
      reasonRequired: boolean
    }
  }
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

export function OrganizationSupportCard({
  organizationId,
  members,
  support,
}: OrganizationSupportCardProps) {
  const ownerMembers = members.filter((member) => member.role === MEMBERSHIP_ROLE.OWNER)
  const soleOwner = ownerMembers.length === 1 ? ownerMembers[0] : null

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Soporte profundo</CardTitle>
        <CardDescription>Sesiones activas, impersonación y timeline operativo auditado.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Sesión por defecto {support.guardrails.defaultDurationHours}h · máximo {support.guardrails.maxDurationHours}h · motivo obligatorio.
        </div>

        <form action={createSupportAccessSessionFromOpsDetailAction} className="grid gap-3 rounded-xl border bg-muted/20 p-4 md:grid-cols-[140px_120px_1fr_auto]">
          <input type="hidden" name="organizationId" value={organizationId} />
          <select
            name="mode"
            defaultValue="read_only"
            className="flex h-9 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="read_only">Lectura</option>
            <option value="read_write">Escritura</option>
          </select>
          <Input name="durationHours" defaultValue={String(support.guardrails.defaultDurationHours)} />
          <Input name="reason" required placeholder="Motivo de soporte" />
          <Button type="submit" variant="outline">
            Abrir soporte
          </Button>
        </form>

        {soleOwner ? (
          <form action={startOwnerImpersonationAction} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 p-4">
            <div className="space-y-1">
              <p className="font-medium">Entrar como owner</p>
              <p className="text-sm text-muted-foreground">
                Acceso rápido temporal como {soleOwner.user?.name || soleOwner.user?.email || soleOwner.userId}.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="organizationId" value={organizationId} />
              <input type="hidden" name="returnTo" value={`/ops/organizations/${organizationId}`} />
              <input type="hidden" name="durationHours" value="1" />
              <Button type="submit">Entrar como owner</Button>
            </div>
          </form>
        ) : null}

        {members.length > 0 ? (
          <form action={startImpersonationAction} className="grid gap-3 rounded-xl border bg-muted/20 p-4 md:grid-cols-[minmax(0,1fr)_140px_1fr_auto]">
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="returnTo" value={`/ops/organizations/${organizationId}`} />
            <select
              name="assumedUserId"
              defaultValue={members[0]?.userId ?? ""}
              className="flex h-9 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {(member.user?.name || member.user?.email || member.userId)} · {member.role}
                </option>
              ))}
            </select>
            <select
              name="mode"
              defaultValue="read_write"
              className="flex h-9 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="read_write">Escritura</option>
              <option value="read_only">Lectura</option>
            </select>
            <Input name="reason" required placeholder="Motivo de impersonación" />
            <Button type="submit">Entrar como</Button>
          </form>
        ) : null}

        <div className="space-y-3">
          <div>
            <p className="font-medium">Sesiones activas</p>
            <p className="text-sm text-muted-foreground">Revocables desde aquí mismo.</p>
          </div>
          {support.activeSessions.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              No hay sesiones activas ahora mismo.
            </div>
          ) : (
            support.activeSessions.map((session) => (
              <div key={session.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4">
                <div className="space-y-1">
                  <p className="font-medium">{session.user?.name || session.user?.email || session.userId}</p>
                  <p className="text-sm text-muted-foreground">{session.mode} · caduca {formatDateLabel(session.expiresAt)}</p>
                  <p className="text-sm text-muted-foreground">{session.reason}</p>
                  {session.assumedUser ? (
                    <p className="text-xs text-muted-foreground">
                      Actuando como {session.assumedUser.name || session.assumedUser.email || session.assumedUser.id}
                    </p>
                  ) : null}
                </div>
                <form action={revokeSupportAccessSessionFromOpsDetailAction}>
                  <input type="hidden" name="organizationId" value={organizationId} />
                  <input type="hidden" name="sessionId" value={session.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    Revocar
                  </Button>
                </form>
              </div>
            ))
          )}
        </div>

        <div className="space-y-3">
          <div>
            <p className="font-medium">Timeline operativo</p>
            <p className="text-sm text-muted-foreground">Historial reciente de soporte e impersonación.</p>
          </div>
          {support.timeline.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              Aún no hay eventos de soporte registrados.
            </div>
          ) : (
            support.timeline.map((item) => (
              <div key={`${item.kind}-${item.id}`} className="rounded-xl border p-4">
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDateLabel(item.occurredAt)}</p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
