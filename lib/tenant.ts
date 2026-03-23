type TenantUser = {
  id: string
  defaultOrganizationId: string | null
}

type TenantOrganization = {
  id: string
  name: string
}

type TenantMembership = {
  id: string
  userId: string
  organizationId: string
  role: string
  accessSource?: "membership" | "support"
  supportAccessMode?: "read_only" | "read_write" | null
}

type TenantSupportAccessSession = {
  id: string
  userId: string
  organizationId: string
  mode: "read_only" | "read_write"
}

export const TENANT_ADMIN_ROLES = ["owner", "admin"] as const

type TenantDependencies = {
  getCurrentUser?: () => Promise<TenantUser>
  ensureOrganizationBootstrapForUser?: (userId: string) => Promise<unknown>
  getOrganizationById?: (organizationId: string) => Promise<TenantOrganization | null>
  getDefaultOrganizationForUser?: (userId: string) => Promise<TenantOrganization | null>
  getMembershipByUserAndOrganization?: (
    userId: string,
    organizationId: string
  ) => Promise<TenantMembership | null>
  getActiveSupportAccessSession?: (input: {
    userId: string
    organizationId: string
  }) => Promise<TenantSupportAccessSession | null>
}

async function resolveDependencies(dependencies: TenantDependencies = {}) {
  const [authModule, organizationsModule, membershipsModule, supportAccessModule] = await Promise.all([
    dependencies.getCurrentUser ? null : import("./auth.ts"),
    dependencies.ensureOrganizationBootstrapForUser
      && dependencies.getDefaultOrganizationForUser
      && dependencies.getOrganizationById
      ? null
      : import("../models/organizations.ts"),
    dependencies.getMembershipByUserAndOrganization ? null : import("../models/memberships.ts"),
    dependencies.getActiveSupportAccessSession ? null : import("../models/support-access.ts"),
  ])

  return {
    getCurrentUser: dependencies.getCurrentUser ?? authModule!.getCurrentUser,
    ensureOrganizationBootstrapForUser:
      dependencies.ensureOrganizationBootstrapForUser ??
      organizationsModule!.ensureOrganizationBootstrapForUser,
    getOrganizationById: dependencies.getOrganizationById ?? organizationsModule!.getOrganizationById,
    getDefaultOrganizationForUser:
      dependencies.getDefaultOrganizationForUser ?? organizationsModule!.getDefaultOrganizationForUser,
    getMembershipByUserAndOrganization:
      dependencies.getMembershipByUserAndOrganization ??
      membershipsModule!.getMembershipByUserAndOrganization,
    getActiveSupportAccessSession:
      dependencies.getActiveSupportAccessSession ??
      supportAccessModule!.getActiveSupportAccessSession,
  }
}

async function resolveCurrentTenantContext(dependencies: TenantDependencies = {}) {
  const runtime = await resolveDependencies(dependencies)
  const user = await runtime.getCurrentUser()

  await runtime.ensureOrganizationBootstrapForUser(user.id)

  const organization = user.defaultOrganizationId
    ? await runtime.getOrganizationById(user.defaultOrganizationId)
    : await runtime.getDefaultOrganizationForUser(user.id)

  return {
    user,
    organization,
    runtime,
  }
}

export async function getCurrentOrganization(dependencies: TenantDependencies = {}) {
  const { organization } = await resolveCurrentTenantContext(dependencies)
  return organization
}

export async function requireCurrentOrganization(dependencies: TenantDependencies = {}) {
  const organization = await getCurrentOrganization(dependencies)

  if (!organization) {
    throw new Error("No se pudo resolver la organización activa")
  }

  return organization
}

export async function requireCurrentOrganizationId(dependencies: TenantDependencies = {}) {
  const organization = await requireCurrentOrganization(dependencies)
  return organization.id
}

export async function requireCurrentWritableOrganizationId(dependencies: TenantDependencies = {}) {
  await requireCurrentTenantWriteAccess(dependencies)
  return await requireCurrentOrganizationId(dependencies)
}

export async function getCurrentMembership(dependencies: TenantDependencies = {}) {
  const { user, organization, runtime } = await resolveCurrentTenantContext(dependencies)

  if (!organization) {
    return null
  }

  const membership = await runtime.getMembershipByUserAndOrganization(user.id, organization.id)

  if (membership) {
    return {
      ...membership,
      accessSource: "membership" as const,
      supportAccessMode: null,
    }
  }

  const supportSession = await runtime.getActiveSupportAccessSession({
    userId: user.id,
    organizationId: organization.id,
  })

  if (!supportSession) {
    return null
  }

  return {
    id: supportSession.id,
    userId: supportSession.userId,
    organizationId: supportSession.organizationId,
    role: "support",
    accessSource: "support" as const,
    supportAccessMode: supportSession.mode,
  }
}

export async function requireCurrentMembership(dependencies: TenantDependencies = {}) {
  const membership = await getCurrentMembership(dependencies)

  if (!membership) {
    throw new Error("No se pudo resolver la membresía activa")
  }

  return membership
}

export async function requireCurrentTenantProfile(dependencies: TenantDependencies = {}) {
  const [organization, membership] = await Promise.all([
    requireCurrentOrganization(dependencies),
    requireCurrentMembership(dependencies),
  ])

  return {
    organization,
    membership,
  }
}

export function isTenantAdminRole(role: string | null | undefined) {
  return TENANT_ADMIN_ROLES.includes(role as (typeof TENANT_ADMIN_ROLES)[number])
}

export function isReadOnlyTenantAccess(
  membership:
    | {
        accessSource?: "membership" | "support"
        supportAccessMode?: "read_only" | "read_write" | null
      }
    | null
    | undefined
) {
  return membership?.accessSource === "support" && membership.supportAccessMode === "read_only"
}

export async function requireCurrentTenantAdmin(dependencies: TenantDependencies = {}) {
  const membership = await requireCurrentMembership(dependencies)

  if (!isTenantAdminRole(membership.role)) {
    throw new Error("No tienes permisos para esta acción")
  }

  return membership
}

export async function requireCurrentTenantWriteAccess(dependencies: TenantDependencies = {}) {
  const membership = await requireCurrentMembership(dependencies)

  if (isReadOnlyTenantAccess(membership)) {
    throw new Error("La sesión de soporte activa es de solo lectura")
  }

  return membership
}
