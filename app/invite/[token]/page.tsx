import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { createPageMetadata } from "@/lib/i18n"
import { prisma } from "@/lib/db"
import Link from "next/link"

import { acceptInvitationAction } from "./actions"

export const metadata = createPageMetadata("common.settings")

export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const invitation = await prisma.organizationInvitation.findUnique({
    where: {
      token,
    },
    include: {
      organization: {
        select: {
          name: true,
        },
      },
    },
  })

  if (!invitation) {
    return (
      <Card className="mx-auto mt-12 w-full max-w-xl">
        <CardHeader>
          <CardTitle>Invitación no válida</CardTitle>
          <CardDescription>El enlace no existe o ya no está disponible.</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild>
            <Link href="/dashboard">Ir al dashboard</Link>
          </Button>
        </CardFooter>
      </Card>
    )
  }

  const isClosed = Boolean(invitation.revokedAt || invitation.acceptedAt)

  return (
    <Card className="mx-auto mt-12 w-full max-w-xl">
      <CardHeader>
        <CardTitle>Invitación a {invitation.organization.name}</CardTitle>
        <CardDescription>
          Vas a entrar en esta empresa con el rol <strong>{invitation.role}</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>Email invitado: {invitation.email}</p>
        <p>Caduca: {new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(invitation.expiresAt)}</p>
        {invitation.revokedAt ? <p>La invitación ya fue revocada.</p> : null}
        {invitation.acceptedAt ? <p>La invitación ya fue aceptada.</p> : null}
      </CardContent>
      <CardFooter className="flex gap-3">
        <form action={acceptInvitationAction.bind(null, token)} className="w-full">
          <Button type="submit" className="w-full" disabled={isClosed}>
            Aceptar invitación
          </Button>
        </form>
        <Button asChild variant="outline" className="w-full">
          <Link href="/dashboard">Cancelar</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
