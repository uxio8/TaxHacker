"use client"

import {
  changeMemberRoleAction,
  inviteMemberAction,
  removeMemberAction,
  revokeInvitationAction,
} from "@/app/(app)/settings/organization-actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { MEMBERSHIP_ROLE, type MembershipRole } from "@/lib/membership-roles"
import { MailPlus, ShieldAlert, UserMinus, Users } from "lucide-react"
import Link from "next/link"
import { useActionState } from "react"

type MemberItem = {
  id: string
  userId: string
  name: string | null
  email: string | null
  role: MembershipRole
  isCurrentUser: boolean
}

type InvitationItem = {
  id: string
  email: string
  role: MembershipRole
  status: "pending" | "accepted" | "revoked"
  token: string
  expiresAtLabel: string
}

type MembersManagementProps = {
  canManageMembers: boolean
  memberLimitLabel: string
  members: MemberItem[]
  invitations: InvitationItem[]
}

function roleLabel(role: MembershipRole) {
  switch (role) {
    case MEMBERSHIP_ROLE.OWNER:
      return "Owner"
    case MEMBERSHIP_ROLE.ADMIN:
      return "Admin"
    default:
      return "Miembro"
  }
}

function invitationStatusLabel(status: InvitationItem["status"]) {
  switch (status) {
    case "accepted":
      return "Aceptada"
    case "revoked":
      return "Revocada"
    default:
      return "Pendiente"
  }
}

export function MembersManagement({
  canManageMembers,
  memberLimitLabel,
  members,
  invitations,
}: MembersManagementProps) {
  const [inviteState, inviteAction, invitePending] = useActionState(inviteMemberAction, null)

  return (
    <div className="flex w-full flex-col gap-6">
      <Card className="shadow-sm">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Organización</Badge>
            <span className="text-sm text-muted-foreground">
              {members.length} miembros activos · Límite actual {memberLimitLabel}
            </span>
          </div>
          <div className="space-y-1">
            <CardTitle>Miembros e invitaciones</CardTitle>
            <CardDescription>
              Gestiona acceso por empresa. Los cambios afectan solo a la organización activa.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canManageMembers ? (
            <Alert>
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Acceso de solo lectura</AlertTitle>
              <AlertDescription>
                Puedes revisar quién tiene acceso, pero solo owners y admins pueden invitar, revocar o cambiar roles.
              </AlertDescription>
            </Alert>
          ) : null}

          <form action={inviteAction} className="grid gap-3 rounded-xl border bg-muted/20 p-4 md:grid-cols-[1fr_180px_auto]">
            <Input
              type="email"
              name="email"
              required
              placeholder="persona@empresa.com"
              aria-label="Email de la invitación"
            />
            <select
              name="role"
              defaultValue={MEMBERSHIP_ROLE.MEMBER}
              className="flex h-9 rounded-md border border-input bg-background px-3 py-2 text-sm"
              aria-label="Rol de la invitación"
            >
              <option value={MEMBERSHIP_ROLE.MEMBER}>Miembro</option>
              <option value={MEMBERSHIP_ROLE.ADMIN}>Admin</option>
              <option value={MEMBERSHIP_ROLE.OWNER}>Owner</option>
            </select>
            <Button type="submit" disabled={!canManageMembers || invitePending}>
              <MailPlus className="h-4 w-4" />
              {invitePending ? "Enviando..." : "Invitar"}
            </Button>
          </form>

          {inviteState?.success && inviteState.data?.email ? (
            <Alert>
              <Users className="h-4 w-4" />
              <AlertTitle>Invitación creada</AlertTitle>
              <AlertDescription>
                Se ha registrado la invitación para {inviteState.data.email}. Comparte el enlace desde la tabla de
                invitaciones para que esa persona complete el acceso.
              </AlertDescription>
            </Alert>
          ) : null}

          {inviteState?.error ? (
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>No se pudo crear la invitación</AlertTitle>
              <AlertDescription>{inviteState.error}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Miembros actuales</CardTitle>
          <CardDescription>Roles activos para esta empresa. Los permisos de plataforma se gestionan aparte.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Persona</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const disableRoleChange =
                  !canManageMembers || (member.isCurrentUser && member.role === MEMBERSHIP_ROLE.OWNER)

                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{member.name || member.email || "Usuario sin nombre"}</p>
                        <p className="text-sm text-muted-foreground">
                          {member.email || "Sin email"} {member.isCurrentUser ? "· Tú" : ""}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{roleLabel(member.role)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <form action={changeMemberRoleAction} className="flex items-center gap-2">
                          <input type="hidden" name="userId" value={member.userId} />
                          <select
                            name="role"
                            defaultValue={member.role}
                            disabled={disableRoleChange}
                            className="flex h-8 rounded-md border border-input bg-background px-2 text-xs"
                            aria-label={`Rol de ${member.email || member.name || member.userId}`}
                          >
                            <option value={MEMBERSHIP_ROLE.MEMBER}>Miembro</option>
                            <option value={MEMBERSHIP_ROLE.ADMIN}>Admin</option>
                            <option value={MEMBERSHIP_ROLE.OWNER}>Owner</option>
                          </select>
                          <Button type="submit" variant="outline" size="sm" disabled={disableRoleChange}>
                            Guardar rol
                          </Button>
                        </form>

                        <form action={removeMemberAction}>
                          <input type="hidden" name="userId" value={member.userId} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            disabled={!canManageMembers || member.isCurrentUser}
                          >
                            <UserMinus className="h-4 w-4" />
                            Quitar
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

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Invitaciones</CardTitle>
          <CardDescription>Estado de accesos pendientes o ya cerrados para esta organización.</CardDescription>
        </CardHeader>
        <CardContent>
          {invitations.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
              No hay invitaciones registradas todavía.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{invitation.email}</p>
                        <p className="text-sm text-muted-foreground">Caduca {invitation.expiresAtLabel}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{roleLabel(invitation.role)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={invitation.status === "pending" ? "default" : "secondary"}>
                        {invitationStatusLabel(invitation.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-2">
                        {invitation.status === "pending" ? (
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/invite/${invitation.token}`}>Abrir enlace</Link>
                          </Button>
                        ) : null}
                        <form action={revokeInvitationAction} className="inline-flex">
                          <input type="hidden" name="token" value={invitation.token} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            disabled={!canManageMembers || invitation.status !== "pending"}
                          >
                            Revocar
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
