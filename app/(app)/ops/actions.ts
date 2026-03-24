"use server"

import { ActionState } from "@/lib/actions"
import { getCurrentActorUser } from "@/lib/auth"
import config from "@/lib/config"
import {
  PLATFORM_IMPERSONATION_COOKIE_NAME,
  buildPlatformImpersonationCookieValue,
} from "@/lib/impersonation"
import { MEMBERSHIP_ROLE } from "@/lib/membership-roles"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { createPlatformAuditLog } from "@/models/platform-audit"
import { canAccessPlatformOps, listPlatformRolesForUser, PLATFORM_ROLE } from "@/models/platform-admins"
import { getMembershipByUserAndOrganization } from "@/models/memberships"
import { setOrganizationAccessOverride } from "@/models/ops"
import { createOrganizationForOps } from "@/models/organizations"
import {
  createSupportAccessSession,
  getActiveSupportAccessSessionByIdForUser,
  revokeSupportAccessSession,
} from "@/models/support-access"
import { readPlatformImpersonationCookieSessionId } from "@/lib/security"

function readString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function readStringList(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => (typeof value === "string" ? value.trim() : ""))
}

function getSafeReturnPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard"
  }

  return value
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

function canManageSupport(roles: string[]) {
  return roles.some((role) =>
    role === PLATFORM_ROLE.OWNER || role === PLATFORM_ROLE.ADMIN || role === PLATFORM_ROLE.SUPPORT
  )
}

function canManageOrganizationState(roles: string[]) {
  return roles.some((role) => role === PLATFORM_ROLE.OWNER || role === PLATFORM_ROLE.ADMIN)
}

function canStartReadOnlyImpersonation(roles: string[]) {
  return canManageSupport(roles)
}

function canStartReadWriteImpersonation(roles: string[]) {
  return canManageOrganizationState(roles)
}

function isInitialUserRole(value: string): value is typeof MEMBERSHIP_ROLE.ADMIN | typeof MEMBERSHIP_ROLE.MEMBER {
  return value === MEMBERSHIP_ROLE.ADMIN || value === MEMBERSHIP_ROLE.MEMBER
}

export async function createOrganizationFromOpsAction(
  _prevState: ActionState<{
    organizationName: string
    ownerEmail: string
    ownerType: string
  }> | null,
  formData: FormData
): Promise<ActionState<{
  organizationName: string
  ownerEmail: string
  ownerType: string
}>> {
  const { user, roles } = await requireOpsActor()
  const name = readString(formData, "name")
  const ownerEmail = readString(formData, "ownerEmail")
  const initialUserEmails = readStringList(formData, "initialUserEmail")
  const initialUserRoles = readStringList(formData, "initialUserRole")

  if (!canManageOrganizationState(roles)) {
    return {
      success: false,
      error: "No tienes permisos para crear empresas",
    }
  }

  if (!name) {
    return {
      success: false,
      error: "Indica el nombre de la empresa.",
    }
  }

  if (!ownerEmail || !ownerEmail.includes("@")) {
    return {
      success: false,
      error: "Indica un email de owner válido.",
    }
  }

  const initialUsers: Array<{
    email: string
    role: typeof MEMBERSHIP_ROLE.ADMIN | typeof MEMBERSHIP_ROLE.MEMBER
  }> = []

  for (const [index, email] of initialUserEmails.entries()) {
    if (!email) {
      continue
    }

    if (!email.includes("@")) {
      return {
        success: false,
        error: `Revisa el email del usuario inicial ${index + 1}.`,
      }
    }

    const role = initialUserRoles[index] ?? ""
    if (!isInitialUserRole(role)) {
      return {
        success: false,
        error: `Revisa el rol del usuario inicial ${index + 1}.`,
      }
    }

    initialUsers.push({
      email,
      role,
    })
  }

  const created = await createOrganizationForOps({
    name,
    ownerEmail,
    actorUserId: user.id,
    initialUsers,
  })

  await createPlatformAuditLog({
    action: "organization.created",
    actorUserId: user.id,
    organizationId: created.organization.id,
    reason: `Alta manual desde Ops para ${created.organization.name}`,
    payload: {
      ownerType: created.owner.type,
      ownerEmail: created.owner.email,
      ownerUserId: created.owner.type === "existing_user" ? created.owner.userId : null,
      initialUserCount: created.initialUsers.length,
      initialUsers: created.initialUsers.map((initialUser) => ({
        type: initialUser.type,
        email: initialUser.email,
        role: initialUser.role,
        userId: initialUser.type === "existing_user" ? initialUser.userId : null,
      })),
    },
  })

  revalidatePath("/ops")
  revalidatePath(`/ops/organizations/${created.organization.id}`)
  redirect(`/ops/organizations/${created.organization.id}`)
}

export async function createSupportAccessSessionAction(formData: FormData) {
  const { user, roles } = await requireOpsActor()
  const organizationId = readString(formData, "organizationId")
  const mode = readString(formData, "mode") === "write" ? "read_write" : "read_only"
  const reason = readString(formData, "reason")
  const durationHours = Number(readString(formData, "durationHours") || "2")

  if (!canManageSupport(roles)) {
    throw new Error("No tienes permisos para abrir sesiones de soporte")
  }

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

  revalidatePath("/ops")
}

export async function revokeSupportAccessSessionAction(formData: FormData) {
  const { user, roles } = await requireOpsActor()
  const sessionId = readString(formData, "sessionId")
  const organizationId = readString(formData, "organizationId")
  const reason = readString(formData, "reason") || "Revocada manualmente desde Ops"

  if (!canManageSupport(roles)) {
    throw new Error("No tienes permisos para revocar sesiones de soporte")
  }

  if (!sessionId) {
    throw new Error("Falta la sesión de soporte")
  }

  await revokeSupportAccessSession({ sessionId })
  await createPlatformAuditLog({
    action: "support_access.revoked",
    actorUserId: user.id,
    organizationId: organizationId || null,
    reason,
    payload: {
      sessionId,
    },
  })

  revalidatePath("/ops")
}

export async function setOrganizationAccessOverrideAction(formData: FormData) {
  const { user, roles } = await requireOpsActor()
  const organizationId = readString(formData, "organizationId")
  const accessStatus = readString(formData, "accessStatus")
  const reason = readString(formData, "reason") || "Cambio manual desde Ops"

  if (!canManageOrganizationState(roles)) {
    throw new Error("No tienes permisos para cambiar el estado de acceso")
  }

  if (!organizationId) {
    throw new Error("Falta la organización")
  }

  await setOrganizationAccessOverride({
    organizationId,
    actorUserId: user.id,
    accessStatus: accessStatus === "restricted" || accessStatus === "suspended" ? accessStatus : null,
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

  revalidatePath("/ops")
}

export async function startImpersonationAction(formData: FormData) {
  const { user, roles } = await requireOpsActor()
  const organizationId = readString(formData, "organizationId")
  const assumedUserId = readString(formData, "assumedUserId")
  const reason = readString(formData, "reason") || "Impersonación iniciada desde Ops"
  const requestedMode = readString(formData, "mode") === "read_only" ? "read_only" : "read_write"
  const durationHours = Number(readString(formData, "durationHours") || "1")
  const returnTo = getSafeReturnPath(readString(formData, "returnTo") || "/dashboard")

  if (!organizationId || !assumedUserId) {
    throw new Error("Faltan organización o usuario objetivo")
  }

  if (!canStartReadOnlyImpersonation(roles)) {
    throw new Error("No tienes permisos para iniciar impersonación")
  }

  if (requestedMode === "read_write" && !canStartReadWriteImpersonation(roles)) {
    throw new Error("No tienes permisos para impersonación con escritura")
  }

  const targetMembership = await getMembershipByUserAndOrganization(assumedUserId, organizationId)

  if (!targetMembership) {
    throw new Error("El usuario objetivo ya no pertenece a la organización")
  }

  const mode = requestedMode === "read_write" && canStartReadWriteImpersonation(roles)
    ? "read_write"
    : "read_only"
  const expiresAt = new Date(Date.now() + Math.max(durationHours, 1) * 60 * 60 * 1000)

  const session = await createSupportAccessSession({
    organizationId,
    userId: user.id,
    assumedUserId,
    mode,
    reason,
    expiresAt,
  })

  const cookieStore = await cookies()
  cookieStore.set(
    PLATFORM_IMPERSONATION_COOKIE_NAME,
    await buildPlatformImpersonationCookieValue(
      {
        actorUserId: user.id,
        sessionId: session.id,
      },
      config.auth.secret
    ),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: config.app.baseURL.startsWith("https://"),
      path: "/",
      maxAge: Math.max(durationHours, 1) * 60 * 60,
    }
  )

  await createPlatformAuditLog({
    action: "support_impersonation.started",
    actorUserId: user.id,
    targetUserId: assumedUserId,
    organizationId,
    reason,
    payload: {
      sessionId: session.id,
      mode,
      expiresAt: expiresAt.toISOString(),
      returnTo,
    },
  })

  revalidatePath("/ops")
  revalidatePath("/")
  redirect(returnTo)
}

export async function stopImpersonationAction(formData?: FormData) {
  const actor = await getCurrentActorUser()
  const returnTo = getSafeReturnPath(readString(formData ?? new FormData(), "returnTo") || "/ops")
  const cookieStore = await cookies()
  const sessionId = await readPlatformImpersonationCookieSessionId(
    cookieStore.get(PLATFORM_IMPERSONATION_COOKIE_NAME)?.value,
    actor.id,
    config.auth.secret
  )

  cookieStore.set(PLATFORM_IMPERSONATION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: config.app.baseURL.startsWith("https://"),
    path: "/",
    maxAge: 0,
  })

  if (sessionId) {
    const activeSession = await getActiveSupportAccessSessionByIdForUser({
      sessionId,
      userId: actor.id,
    })

    await revokeSupportAccessSession({ sessionId })
    await createPlatformAuditLog({
      action: "support_impersonation.stopped",
      actorUserId: actor.id,
      targetUserId: activeSession?.assumedUserId ?? null,
      organizationId: activeSession?.organizationId ?? null,
      reason: "Impersonación cerrada desde la app",
      payload: {
        sessionId,
      },
    })
  }

  revalidatePath("/ops")
  revalidatePath("/")
  redirect(returnTo)
}
