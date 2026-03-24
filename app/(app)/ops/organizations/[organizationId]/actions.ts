"use server"

import { getCurrentActorUser } from "@/lib/auth"
import { MEMBERSHIP_ROLE, type MembershipRole } from "@/lib/membership-roles"
import { revalidatePath } from "next/cache"
import type { Role } from "@/prisma/client"

import { createPlatformAuditLog } from "@/models/platform-audit"
import { canAccessPlatformOps, listPlatformRolesForUser, PLATFORM_ROLE } from "@/models/platform-admins"
import {
  createOrganizationInvitation,
  revokeOrganizationInvitation,
} from "@/models/invitations"
import {
  deleteMembership,
  listMembersByOrganizationId,
  transferOrganizationOwnership,
  upsertMembership,
} from "@/models/memberships"
import { setOrganizationAccessOverride } from "@/models/ops"
import {
  scheduleOrganizationPlanChangeFromOps,
  setOrganizationAddonsFromOps,
  setOrganizationPlanFromOps,
} from "@/models/ops-billing-admin"
import { createSupportAccessSession, revokeSupportAccessSession } from "@/models/support-access"

function readString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function readStringList(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .flatMap((value) => (typeof value === "string" ? [value.trim()] : []))
    .filter(Boolean)
}

function isMembershipRole(value: string): value is MembershipRole {
  return Object.values(MEMBERSHIP_ROLE).includes(value as MembershipRole)
}

async function requireOpsActor() {
  const user = await getCurrentActorUser()
  const allowed = await canAccessPlatformOps(user.id)

  if (!allowed) {
    throw new Error("No tienes acceso al control plane")
  }

  return {
    user,
    roles: await listPlatformRolesForUser(user.id),
  }
}

function canManageContract(roles: string[]) {
  return roles.some((role) =>
    role === PLATFORM_ROLE.OWNER || role === PLATFORM_ROLE.ADMIN || role === PLATFORM_ROLE.FINANCE
  )
}

function canManageMembers(roles: string[]) {
  return roles.some((role) => role === PLATFORM_ROLE.OWNER || role === PLATFORM_ROLE.ADMIN)
}

function canManageSupport(roles: string[]) {
  return roles.some((role) =>
    role === PLATFORM_ROLE.OWNER || role === PLATFORM_ROLE.ADMIN || role === PLATFORM_ROLE.SUPPORT
  )
}

function revalidateOpsOrganization(organizationId: string) {
  revalidatePath("/ops")
  revalidatePath(`/ops/organizations/${organizationId}`)
}

export async function setOrganizationPlanFromOpsAction(formData: FormData) {
  const { user, roles } = await requireOpsActor()
  if (!canManageContract(roles)) {
    throw new Error("No tienes permisos para gestionar contrato")
  }

  const organizationId = readString(formData, "organizationId")
  const planCode = readString(formData, "planCode")
  const reason = readString(formData, "reason") || "Cambio manual de plan desde Ops"

  if (!organizationId || !planCode) {
    throw new Error("Faltan organización o plan")
  }

  await setOrganizationPlanFromOps({
    organizationId,
    planCode,
    actorUserId: user.id,
    reason,
  })

  revalidateOpsOrganization(organizationId)
}

export async function setOrganizationAddonsFromOpsAction(formData: FormData) {
  const { user, roles } = await requireOpsActor()
  if (!canManageContract(roles)) {
    throw new Error("No tienes permisos para gestionar addons")
  }

  const organizationId = readString(formData, "organizationId")
  const addonCodes = readStringList(formData, "addonCodes")
  const fallbackPlanCode = readString(formData, "fallbackPlanCode") || "starter"
  const reason = readString(formData, "reason") || "Cambio manual de addons desde Ops"

  if (!organizationId) {
    throw new Error("Falta la organización")
  }

  await setOrganizationAddonsFromOps({
    organizationId,
    addonCodes,
    fallbackPlanCode,
    actorUserId: user.id,
    reason,
  })

  revalidateOpsOrganization(organizationId)
}

export async function scheduleOrganizationPlanChangeFromOpsAction(formData: FormData) {
  const { user, roles } = await requireOpsActor()
  if (!canManageContract(roles)) {
    throw new Error("No tienes permisos para programar cambios de plan")
  }

  const organizationId = readString(formData, "organizationId")
  const scheduledPlanCode = readString(formData, "scheduledPlanCode") || null
  const fallbackPlanCode = readString(formData, "fallbackPlanCode") || "starter"
  const reason = readString(formData, "reason") || "Cambio programado desde Ops"

  if (!organizationId) {
    throw new Error("Falta la organización")
  }

  await scheduleOrganizationPlanChangeFromOps({
    organizationId,
    scheduledPlanCode,
    fallbackPlanCode,
    actorUserId: user.id,
    reason,
  })

  revalidateOpsOrganization(organizationId)
}

export async function inviteMemberFromOpsAction(formData: FormData) {
  const { user, roles } = await requireOpsActor()
  if (!canManageMembers(roles)) {
    throw new Error("No tienes permisos para gestionar miembros")
  }

  const organizationId = readString(formData, "organizationId")
  const email = readString(formData, "email")
  const role = readString(formData, "role")

  if (!organizationId || !email || !email.includes("@") || !isMembershipRole(role)) {
    throw new Error("Datos de invitación no válidos")
  }

  await createOrganizationInvitation({
    organizationId,
    email,
    role: role as Role,
    invitedByUserId: user.id,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
  })

  await createPlatformAuditLog({
    action: "organization.member.invited",
    actorUserId: user.id,
    organizationId,
    reason: `Invitación a ${email}`,
    payload: {
      email,
      role,
    },
  })

  revalidateOpsOrganization(organizationId)
}

export async function changeMemberRoleFromOpsAction(formData: FormData) {
  const { user, roles } = await requireOpsActor()
  if (!canManageMembers(roles)) {
    throw new Error("No tienes permisos para gestionar miembros")
  }

  const organizationId = readString(formData, "organizationId")
  const userId = readString(formData, "userId")
  const role = readString(formData, "role")

  if (!organizationId || !userId || !isMembershipRole(role)) {
    throw new Error("Cambio de rol no válido")
  }

  await upsertMembership(userId, organizationId, role)
  await createPlatformAuditLog({
    action: "organization.member.role_updated",
    actorUserId: user.id,
    targetUserId: userId,
    organizationId,
    reason: `Rol cambiado a ${role}`,
    payload: {
      role,
    },
  })

  revalidateOpsOrganization(organizationId)
}

export async function removeMemberFromOpsAction(formData: FormData) {
  const { user, roles } = await requireOpsActor()
  if (!canManageMembers(roles)) {
    throw new Error("No tienes permisos para gestionar miembros")
  }

  const organizationId = readString(formData, "organizationId")
  const userId = readString(formData, "userId")

  if (!organizationId || !userId) {
    throw new Error("Faltan organización o usuario")
  }

  await deleteMembership(userId, organizationId)
  await createPlatformAuditLog({
    action: "organization.member.removed",
    actorUserId: user.id,
    targetUserId: userId,
    organizationId,
    reason: "Miembro retirado desde Ops",
  })

  revalidateOpsOrganization(organizationId)
}

export async function transferOrganizationOwnershipFromOpsAction(formData: FormData) {
  const { user, roles } = await requireOpsActor()
  if (!canManageMembers(roles)) {
    throw new Error("No tienes permisos para transferir ownership")
  }

  const organizationId = readString(formData, "organizationId")
  const nextOwnerUserId = readString(formData, "nextOwnerUserId")

  if (!organizationId || !nextOwnerUserId) {
    throw new Error("Faltan organización o nueva persona owner")
  }

  const members = await listMembersByOrganizationId(organizationId)
  const currentOwner = members.find((member) => member.role === MEMBERSHIP_ROLE.OWNER && member.userId !== nextOwnerUserId)

  if (!currentOwner) {
    throw new Error("No se ha encontrado un owner actual distinto del destino")
  }

  await transferOrganizationOwnership({
    organizationId,
    currentOwnerUserId: currentOwner.userId,
    nextOwnerUserId,
  })

  await createPlatformAuditLog({
    action: "organization.ownership.transferred",
    actorUserId: user.id,
    targetUserId: nextOwnerUserId,
    organizationId,
    reason: "Transferencia de ownership desde Ops",
    payload: {
      previousOwnerUserId: currentOwner.userId,
    },
  })

  revalidateOpsOrganization(organizationId)
}

export async function revokeInvitationFromOpsAction(formData: FormData) {
  const { user, roles } = await requireOpsActor()
  if (!canManageMembers(roles)) {
    throw new Error("No tienes permisos para revocar invitaciones")
  }

  const organizationId = readString(formData, "organizationId")
  const token = readString(formData, "token")

  if (!organizationId || !token) {
    throw new Error("Faltan organización o invitación")
  }

  await revokeOrganizationInvitation({ token })
  await createPlatformAuditLog({
    action: "organization.invitation.revoked",
    actorUserId: user.id,
    organizationId,
    reason: "Invitación revocada desde Ops",
    payload: {
      token,
    },
  })

  revalidateOpsOrganization(organizationId)
}

export async function createSupportAccessSessionFromOpsDetailAction(formData: FormData) {
  const { user, roles } = await requireOpsActor()
  if (!canManageSupport(roles)) {
    throw new Error("No tienes permisos para abrir soporte")
  }

  const organizationId = readString(formData, "organizationId")
  const mode = readString(formData, "mode") === "read_write" ? "read_write" : "read_only"
  const reason = readString(formData, "reason")
  const durationHours = Number(readString(formData, "durationHours") || "2")

  if (!organizationId || !reason) {
    throw new Error("Faltan organización o motivo")
  }

  const expiresAt = new Date(Date.now() + Math.max(durationHours, 1) * 60 * 60 * 1000)

  const session = await createSupportAccessSession({
    organizationId,
    userId: user.id,
    mode,
    reason,
    expiresAt,
  })

  await createPlatformAuditLog({
    action: "support_access.created",
    actorUserId: user.id,
    organizationId,
    reason,
    payload: {
      sessionId: session.id,
      mode,
      expiresAt: expiresAt.toISOString(),
    },
  })

  revalidateOpsOrganization(organizationId)
}

export async function revokeSupportAccessSessionFromOpsDetailAction(formData: FormData) {
  const { user, roles } = await requireOpsActor()
  if (!canManageSupport(roles)) {
    throw new Error("No tienes permisos para revocar soporte")
  }

  const organizationId = readString(formData, "organizationId")
  const sessionId = readString(formData, "sessionId")
  const reason = readString(formData, "reason") || "Revocada manualmente desde Ops"

  if (!organizationId || !sessionId) {
    throw new Error("Faltan organización o sesión")
  }

  await revokeSupportAccessSession({ sessionId })
  await createPlatformAuditLog({
    action: "support_access.revoked",
    actorUserId: user.id,
    organizationId,
    reason,
    payload: {
      sessionId,
    },
  })

  revalidateOpsOrganization(organizationId)
}

export async function setOrganizationAccessOverrideFromOpsDetailAction(formData: FormData) {
  const { user, roles } = await requireOpsActor()
  if (!canManageSupport(roles) && !canManageContract(roles)) {
    throw new Error("No tienes permisos para cambiar el acceso")
  }

  const organizationId = readString(formData, "organizationId")
  const accessStatusRaw = readString(formData, "accessStatus")
  const reason = readString(formData, "reason") || "Cambio manual de acceso desde Ops"

  if (!organizationId) {
    throw new Error("Falta la organización")
  }

  const accessStatus =
    accessStatusRaw === "restricted" || accessStatusRaw === "suspended"
      ? accessStatusRaw
      : null

  await setOrganizationAccessOverride({
    organizationId,
    actorUserId: user.id,
    accessStatus,
    reason,
  })

  await createPlatformAuditLog({
    action: accessStatus ? "organization.access_override.set" : "organization.access_override.cleared",
    actorUserId: user.id,
    organizationId,
    reason,
    payload: {
      accessStatus,
    },
  })

  revalidateOpsOrganization(organizationId)
}
