import {
  changeMemberRoleFromOpsAction,
  inviteMemberFromOpsAction,
  removeMemberFromOpsAction,
  revokeInvitationFromOpsAction,
  transferOrganizationOwnershipFromOpsAction,
} from "@/app/(app)/ops/organizations/[organizationId]/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { MEMBERSHIP_ROLE } from "@/lib/membership-roles"

type OrganizationMembersCardProps = {
  organizationId: string
  members: Array<{
    id: string
    userId: string
    role: string
    user: {
      id: string
      email: string | null
      name: string | null
    } | null
  }>
  invitations: Array<{
    id: string
    email?: string
    emailNormalized?: string
    role: string
    token: string
    expiresAt: Date
    revokedAt: Date | null
    acceptedAt: Date | null
  }>
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

export function OrganizationMembersCard({
  organizationId,
  members,
  invitations,
}: OrganizationMembersCardProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Miembros e invitaciones</CardTitle>
        <CardDescription>Opera personas y acceso interno sin entrar como admin del tenant.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form action={inviteMemberFromOpsAction} className="grid gap-3 rounded-xl border bg-muted/20 p-4 md:grid-cols-[1fr_180px_auto]">
          <input type="hidden" name="organizationId" value={organizationId} />
          <Input type="email" name="email" required placeholder="persona@empresa.com" />
          <select
            name="role"
            defaultValue={MEMBERSHIP_ROLE.MEMBER}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value={MEMBERSHIP_ROLE.MEMBER}>Miembro</option>
            <option value={MEMBERSHIP_ROLE.ADMIN}>Admin</option>
            <option value={MEMBERSHIP_ROLE.OWNER}>Owner</option>
          </select>
          <Button type="submit">Invitar</Button>
        </form>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Persona</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="space-y-1">
                    <p className="font-medium">{member.user?.name || member.user?.email || member.userId}</p>
                    <p className="text-sm text-muted-foreground">{member.user?.email || "Sin email"}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{member.role}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <form action={changeMemberRoleFromOpsAction} className="flex items-center gap-2">
                      <input type="hidden" name="organizationId" value={organizationId} />
                      <input type="hidden" name="userId" value={member.userId} />
                      <select
                        name="role"
                        defaultValue={member.role}
                        className="flex h-8 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        <option value={MEMBERSHIP_ROLE.MEMBER}>Miembro</option>
                        <option value={MEMBERSHIP_ROLE.ADMIN}>Admin</option>
                        <option value={MEMBERSHIP_ROLE.OWNER}>Owner</option>
                      </select>
                      <Button type="submit" variant="outline" size="sm">
                        Guardar rol
                      </Button>
                    </form>

                    {member.role !== MEMBERSHIP_ROLE.OWNER ? (
                      <form action={transferOrganizationOwnershipFromOpsAction}>
                        <input type="hidden" name="organizationId" value={organizationId} />
                        <input type="hidden" name="nextOwnerUserId" value={member.userId} />
                        <Button type="submit" variant="secondary" size="sm">
                          Hacer owner
                        </Button>
                      </form>
                    ) : null}

                    <form action={removeMemberFromOpsAction}>
                      <input type="hidden" name="organizationId" value={organizationId} />
                      <input type="hidden" name="userId" value={member.userId} />
                      <Button type="submit" variant="ghost" size="sm">
                        Quitar
                      </Button>
                    </form>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="space-y-3">
          <div>
            <p className="font-medium">Invitaciones</p>
            <p className="text-sm text-muted-foreground">Pendientes y revocadas dentro de la empresa.</p>
          </div>
          {invitations.length === 0 ? (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              No hay invitaciones registradas.
            </div>
          ) : (
            <div className="space-y-3">
              {invitations.map((invitation) => (
                <div key={invitation.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4">
                  <div className="space-y-1">
                    <p className="font-medium">{invitation.email || invitation.emailNormalized}</p>
                    <p className="text-sm text-muted-foreground">
                      Rol {invitation.role} · caduca {formatDateLabel(invitation.expiresAt)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {invitation.acceptedAt ? "Aceptada" : invitation.revokedAt ? "Revocada" : "Pendiente"}
                    </p>
                  </div>
                  {!invitation.revokedAt && !invitation.acceptedAt ? (
                    <form action={revokeInvitationFromOpsAction}>
                      <input type="hidden" name="organizationId" value={organizationId} />
                      <input type="hidden" name="token" value={invitation.token} />
                      <Button type="submit" variant="ghost" size="sm">
                        Revocar
                      </Button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
