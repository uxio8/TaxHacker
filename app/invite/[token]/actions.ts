"use server"

import { getCurrentUser } from "@/lib/auth"
import { acceptOrganizationInvitation } from "@/models/invitations"
import { redirect } from "next/navigation"

export async function acceptInvitationAction(token: string) {
  const user = await getCurrentUser()

  await acceptOrganizationInvitation({
    token,
    userId: user.id,
    userEmail: user.email,
  })

  redirect("/dashboard")
}
