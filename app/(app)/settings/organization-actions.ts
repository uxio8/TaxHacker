"use server"

import { ActionState } from "@/lib/actions"
import { getCurrentImpersonation, getCurrentUser } from "@/lib/auth"
import { MEMBERSHIP_ROLE, type MembershipRole } from "@/lib/membership-roles"
import { requireCurrentTenantAdmin, requireCurrentTenantProfile } from "@/lib/tenant"
import {
  createOrganizationInvitation,
  revokeOrganizationInvitation,
} from "@/models/invitations"
import {
  deleteMembership,
  upsertMembership,
} from "@/models/memberships"
import { setCurrentOrganizationForUser } from "@/models/organizations"
import type { Role } from "@/prisma/client"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

function readString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function isMembershipRole(value: string): value is MembershipRole {
  return Object.values(MEMBERSHIP_ROLE).includes(value as MembershipRole)
}

function getSafeReturnPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard"
  }

  return value
}

async function getOrganizationContext() {
  const user = await getCurrentUser()
  const profile = await requireCurrentTenantProfile({
    getCurrentUser: async () => user,
  })

  return {
    user,
    ...profile,
  }
}

export async function switchOrganizationAction(formData: FormData) {
  const user = await getCurrentUser()
  const impersonation = await getCurrentImpersonation()
  const organizationId = readString(formData, "organizationId")
  const returnTo = getSafeReturnPath(readString(formData, "returnTo") || "/dashboard")

  if (!organizationId) {
    redirect(returnTo)
  }

  if (impersonation) {
    throw new Error("No puedes cambiar de empresa mientras haya una impersonación activa")
  }

  const switched = await setCurrentOrganizationForUser(user.id, organizationId)

  if (!switched) {
    throw new Error("No tienes acceso a la organización seleccionada")
  }

  revalidatePath("/")
  revalidatePath("/settings")
  redirect(returnTo)
}

export async function inviteMemberAction(
  _prevState: ActionState<{ email: string }> | null,
  formData: FormData
): Promise<ActionState<{ email: string }>> {
  const { user, organization } = await getOrganizationContext()

  await requireCurrentTenantAdmin({
    getCurrentUser: async () => user,
  })

  const email = readString(formData, "email")
  const role = readString(formData, "role")

  if (!email || !email.includes("@")) {
    return { success: false, error: "Introduce un email válido." }
  }

  if (!isMembershipRole(role)) {
    return { success: false, error: "Selecciona un rol válido." }
  }

  await createOrganizationInvitation({
    organizationId: organization.id,
    email,
    role: role as Role,
    invitedByUserId: user.id,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
  })

  revalidatePath("/settings/members")

  return {
    success: true,
    data: {
      email,
    },
  }
}

export async function changeMemberRoleAction(formData: FormData) {
  const { user, organization, membership } = await getOrganizationContext()

  await requireCurrentTenantAdmin({
    getCurrentUser: async () => user,
  })

  const targetUserId = readString(formData, "userId")
  const role = readString(formData, "role")

  if (!targetUserId || !isMembershipRole(role)) {
    return
  }

  if (targetUserId === user.id && membership.role === MEMBERSHIP_ROLE.OWNER && role !== MEMBERSHIP_ROLE.OWNER) {
    throw new Error("El owner activo no puede retirarse el rol owner desde esta pantalla")
  }

  await upsertMembership(targetUserId, organization.id, role)
  revalidatePath("/settings/members")
}

export async function removeMemberAction(formData: FormData) {
  const { user, organization } = await getOrganizationContext()

  await requireCurrentTenantAdmin({
    getCurrentUser: async () => user,
  })

  const targetUserId = readString(formData, "userId")

  if (!targetUserId || targetUserId === user.id) {
    return
  }

  await deleteMembership(targetUserId, organization.id)
  revalidatePath("/settings/members")
}

export async function revokeInvitationAction(formData: FormData) {
  const { user } = await getOrganizationContext()

  await requireCurrentTenantAdmin({
    getCurrentUser: async () => user,
  })

  const token = readString(formData, "token")

  if (!token) {
    return
  }

  await revokeOrganizationInvitation({ token })
  revalidatePath("/settings/members")
}
