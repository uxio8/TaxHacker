import { getCurrentUser } from "@/lib/auth"
import { requireCurrentOrganizationId } from "@/lib/tenant"
import type { CapabilityKey, LimitKey } from "./catalog-types"

import { canUseCapability, getCapabilityLimit, getOrganizationAccess, getOrganizationUsage } from "@/models/billing/access"

export async function getCurrentOrganizationAccess() {
  const user = await getCurrentUser()
  const organizationId = await requireCurrentOrganizationId({
    getCurrentUser: async () => user,
  })

  return getOrganizationAccess(organizationId)
}

export async function requireCurrentOrganizationCapability(capabilityKey: CapabilityKey | string) {
  const access = await getCurrentOrganizationAccess()

  if (!(await canUseCapability(access.organizationId, capabilityKey))) {
    throw new Error("La funcionalidad no está disponible para la organización activa")
  }

  return access
}

export async function getCurrentOrganizationLimit(metricKey: LimitKey | string) {
  const access = await getCurrentOrganizationAccess()
  return getCapabilityLimit(access.organizationId, metricKey)
}

export async function getCurrentOrganizationMetricUsage(metricKey: LimitKey | string) {
  const access = await getCurrentOrganizationAccess()
  return getOrganizationUsage(access.organizationId, metricKey)
}
