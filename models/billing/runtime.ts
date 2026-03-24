import type { AccessStatus } from "../../prisma/client/index.js"

export type UserBillingProjection = {
  membershipPlan: string
  membershipExpiresAt: Date | null
  stripeCustomerId?: string | null
  storageLimit: number
  storageUsed: number
  aiBalance: number
  billingStatus?: string
  accessStatus?: `${AccessStatus}` | null
}

export type SidebarUserProfile = {
  id: string
  name: string
  email: string
  avatar?: string
  membershipPlan: string
  storageUsed: number
  storageLimit: number
  aiBalance: number
}

export type OrganizationActionUser = {
  id: string
  organizationId: string
  email: string
  storageLimit: number
  storageUsed: number
  membershipExpiresAt: Date | null
  accessStatus?: `${AccessStatus}` | null
}

export function isOrganizationAccessRestricted(accessStatus?: `${AccessStatus}` | null) {
  return accessStatus === "restricted" || accessStatus === "suspended"
}

export function getLegacyBillingExpirationDate(
  accessStatus: `${AccessStatus}` | null | undefined,
  currentPeriodEndsAt: Date | null | undefined
) {
  if (isOrganizationAccessRestricted(accessStatus)) {
    return new Date(0)
  }

  return currentPeriodEndsAt ?? null
}

export function buildSidebarUserProfile(
  user: {
    id: string
    name?: string | null
    email: string
    avatar?: string | null
  },
  projection: Pick<UserBillingProjection, "membershipPlan" | "storageUsed" | "storageLimit" | "aiBalance">
): SidebarUserProfile {
  return {
    id: user.id,
    name: user.name || "",
    email: user.email,
    avatar: user.avatar ?? undefined,
    membershipPlan: projection.membershipPlan || "unlimited",
    storageUsed: projection.storageUsed ?? 0,
    storageLimit: projection.storageLimit ?? -1,
    aiBalance: projection.aiBalance ?? 0,
  }
}

export function buildOrganizationActionUser(
  user: {
    id: string
    email: string
  },
  input: {
    organizationId: string
  } & Pick<UserBillingProjection, "storageUsed" | "storageLimit" | "membershipExpiresAt" | "accessStatus">
): OrganizationActionUser {
  return {
    id: user.id,
    email: user.email,
    organizationId: input.organizationId,
    storageLimit: input.storageLimit,
    storageUsed: input.storageUsed,
    membershipExpiresAt: input.membershipExpiresAt,
    accessStatus: input.accessStatus ?? null,
  }
}
