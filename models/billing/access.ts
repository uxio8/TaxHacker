import config from "../../lib/config.ts"
import { BILLING_ADDONS, BILLING_PLANS, getAddonDefinition, getPlanDefinition } from "../../lib/billing/catalog.ts"
import type { CapabilityKey, LimitKey } from "../../lib/billing/catalog-types.ts"
import type { AccessStatus, BillingStatus, OrganizationOverrideType } from "../../prisma/client/index.js"
import { getLegacyBillingExpirationDate } from "./runtime.ts"

export type OrganizationAccessOverride = {
  type: `${OrganizationOverrideType}`
  key: string
  boolValue?: boolean | null
  numberValue?: number | null
  accessStatusValue?: `${AccessStatus}` | null
}

export type BuildOrganizationAccessInput = {
  organizationId: string
  planCode: string
  billingStatus: `${BillingStatus}`
  accessStatus: `${AccessStatus}`
  currentPeriodEndsAt?: Date | null
  stripeCustomerId?: string | null
  addonCodes?: string[]
  usage?: Partial<Record<string, number>>
  overrides?: OrganizationAccessOverride[]
  selfHostedBypass?: boolean
}

export type ResolvedOrganizationAccess = {
  organizationId: string
  billingStatus: `${BillingStatus}`
  accessStatus: `${AccessStatus}`
  stripeCustomerId: string | null
  plan: {
    code: string
    catalogVersion: number
  }
  currentPeriodEndsAt: Date | null
  addonCodes: string[]
  capabilities: Record<string, boolean>
  limits: Record<string, number>
  usage: Record<string, number>
}

type AccessStore = {
  organizationSubscription: {
    findUnique: (args: {
      where: {
        organizationId: string
      }
      include: {
        addons: true
      }
    }) => Promise<{
      organizationId: string
      planCode: string
      catalogVersion: number
      billingStatus: BillingStatus
      accessStatus: AccessStatus
      stripeCustomerId: string | null
      currentPeriodEndsAt: Date | null
      addons: Array<{
        addonCode: string
        isActive: boolean
        expiresAt: Date | null
      }>
    } | null>
  }
  organizationUsage: {
    findMany: (args: {
      where: {
        organizationId: string
      }
    }) => Promise<
      Array<{
        metricKey: string
        quantity: number
        periodKey: string
      }>
    >
  }
  organizationOverride: {
    findMany: (args: {
      where: {
        organizationId: string
      }
    }) => Promise<
      Array<{
        type: OrganizationOverrideType
        key: string
        boolValue: boolean | null
        numberValue: number | null
        accessStatusValue: AccessStatus | null
        expiresAt: Date | null
      }>
    >
  }
}

type OrganizationAccessOptions = {
  store?: AccessStore
  fallback?: {
    planCode?: string | null
    membershipExpiresAt?: Date | null
    stripeCustomerId?: string | null
    storageLimit?: number | null
    storageUsed?: number | null
    aiBalance?: number | null
  } | null
  now?: Date
}

export function buildOrganizationAccess(input: BuildOrganizationAccessInput): ResolvedOrganizationAccess {
  const plan = input.selfHostedBypass ? BILLING_PLANS.unlimited : getPlanDefinition(input.planCode) ?? BILLING_PLANS.early
  const addonCodes = input.selfHostedBypass ? [] : (input.addonCodes ?? []).filter((code) => Boolean(getAddonDefinition(code)))
  const capabilities = Object.fromEntries(plan.capabilities.map((capability) => [capability, true])) as Record<string, boolean>
  const limits = { ...plan.limits } as Record<string, number>

  for (const addonCode of addonCodes) {
    const addon = BILLING_ADDONS[addonCode]
    if (!addon) {
      continue
    }

    for (const capability of addon.capabilityAdds ?? []) {
      capabilities[capability] = true
    }

    for (const [metricKey, increment] of Object.entries(addon.limitIncrements ?? {})) {
      if (typeof increment !== "number") {
        continue
      }

      const currentValue = limits[metricKey]
      limits[metricKey] = currentValue === -1 ? -1 : (currentValue ?? 0) + increment
    }
  }

  let resolvedAccessStatus: `${AccessStatus}` = input.selfHostedBypass ? "enabled" : input.accessStatus

  for (const override of input.overrides ?? []) {
    if (override.type === "capability" && typeof override.boolValue === "boolean") {
      capabilities[override.key] = override.boolValue
    }

    if (override.type === "limit" && typeof override.numberValue === "number") {
      limits[override.key] = override.numberValue
    }

    if (override.type === "access_status" && override.accessStatusValue) {
      resolvedAccessStatus = override.accessStatusValue
    }
  }

  const usage = Object.fromEntries(
    Object.entries(input.usage ?? {}).map(([metricKey, quantity]) => [metricKey, quantity ?? 0])
  )

  return {
    organizationId: input.organizationId,
    billingStatus: input.selfHostedBypass ? "active" : input.billingStatus,
    accessStatus: resolvedAccessStatus,
    stripeCustomerId: input.selfHostedBypass ? null : (input.stripeCustomerId ?? null),
    plan: {
      code: plan.code,
      catalogVersion: plan.version,
    },
    currentPeriodEndsAt: input.currentPeriodEndsAt ?? null,
    addonCodes,
    capabilities,
    limits,
    usage,
  }
}

export function canUseResolvedCapability(access: ResolvedOrganizationAccess, capabilityKey: CapabilityKey | string) {
  if (access.accessStatus === "restricted" || access.accessStatus === "suspended") {
    return false
  }

  return access.capabilities[capabilityKey] === true
}

export function getResolvedLimit(access: ResolvedOrganizationAccess, metricKey: LimitKey | string) {
  return access.limits[metricKey] ?? 0
}

export function getResolvedUsage(access: ResolvedOrganizationAccess, metricKey: LimitKey | string) {
  return access.usage[metricKey] ?? 0
}

export async function getOrganizationAccess(
  organizationId: string,
  options: OrganizationAccessOptions = {}
) {
  if (config.selfHosted.isEnabled) {
    return buildOrganizationAccess({
      organizationId,
      planCode: "unlimited",
      billingStatus: "active",
      accessStatus: "enabled",
      selfHostedBypass: true,
    })
  }

  const db = await resolveStore(options.store)
  const now = options.now ?? new Date()
  const subscription = await db.organizationSubscription.findUnique({
    where: { organizationId },
    include: { addons: true },
  })

  if (!subscription) {
    return buildFallbackOrganizationAccess(organizationId, options.fallback, now)
  }

  const usageRows = await db.organizationUsage.findMany({
    where: { organizationId },
  })
  const overrideRows = await db.organizationOverride.findMany({
    where: { organizationId },
  })

  const usage = Object.fromEntries(
    usageRows
      .filter((row) => row.periodKey === "current" || row.periodKey === getCurrentMonthlyPeriodKey(now))
      .map((row) => [row.metricKey, row.quantity])
  )

  const overrides = overrideRows
    .filter((row) => !row.expiresAt || row.expiresAt > now)
    .map((row) => ({
      type: row.type,
      key: row.key,
      boolValue: row.boolValue,
      numberValue: row.numberValue,
      accessStatusValue: row.accessStatusValue,
    }))

  return buildOrganizationAccess({
    organizationId,
    planCode: subscription.planCode,
    billingStatus: subscription.billingStatus,
    accessStatus: subscription.accessStatus,
    stripeCustomerId: subscription.stripeCustomerId,
    currentPeriodEndsAt: subscription.currentPeriodEndsAt,
    addonCodes: subscription.addons
      .filter((addon) => addon.isActive && (!addon.expiresAt || addon.expiresAt > now))
      .map((addon) => addon.addonCode),
    usage,
    overrides,
  })
}

export async function canUseCapability(
  organizationId: string,
  capabilityKey: CapabilityKey | string,
  options: OrganizationAccessOptions = {}
) {
  const access = await getOrganizationAccess(organizationId, options)
  return canUseResolvedCapability(access, capabilityKey)
}

export async function getCapabilityLimit(
  organizationId: string,
  metricKey: LimitKey | string,
  options: OrganizationAccessOptions = {}
) {
  const access = await getOrganizationAccess(organizationId, options)
  return getResolvedLimit(access, metricKey)
}

export async function getOrganizationUsage(
  organizationId: string,
  metricKey: LimitKey | string,
  options: OrganizationAccessOptions = {}
) {
  const access = await getOrganizationAccess(organizationId, options)
  return getResolvedUsage(access, metricKey)
}

function buildFallbackOrganizationAccess(
  organizationId: string,
  fallback: OrganizationAccessOptions["fallback"],
  now: Date
) {
  const planCode = fallback?.planCode?.trim() || "early"
  const membershipExpiresAt = fallback?.membershipExpiresAt ?? null
  const isExpired = membershipExpiresAt ? membershipExpiresAt < now : false
  const aiBalance = typeof fallback?.aiBalance === "number" ? Math.max(fallback.aiBalance, 0) : undefined
  const storageLimit = typeof fallback?.storageLimit === "number" ? fallback.storageLimit : undefined
  const storageUsed = typeof fallback?.storageUsed === "number" ? Math.max(fallback.storageUsed, 0) : 0

  return buildOrganizationAccess({
    organizationId,
    planCode,
    billingStatus: isExpired ? "past_due" : "active",
    accessStatus: isExpired ? "restricted" : "enabled",
    currentPeriodEndsAt: membershipExpiresAt,
    stripeCustomerId: fallback?.stripeCustomerId ?? null,
    usage: {
      "ai.jobs.monthly": 0,
      "storage.bytes": storageUsed,
    },
    overrides: [
      ...(aiBalance !== undefined
        ? [
            {
              type: "limit" as const,
              key: "ai.jobs.monthly",
              numberValue: aiBalance,
            },
          ]
        : []),
      ...(storageLimit !== undefined
        ? [
            {
              type: "limit" as const,
              key: "storage.bytes",
              numberValue: storageLimit,
            },
          ]
        : []),
    ],
  })
}

export async function getCurrentOrganizationUserBillingProjection(
  organizationId: string,
  options: OrganizationAccessOptions = {}
) {
  const access = await getOrganizationAccess(organizationId, options)
  const aiLimit = getResolvedLimit(access, "ai.jobs.monthly")
  const aiUsage = getResolvedUsage(access, "ai.jobs.monthly")

  return {
    membershipPlan: access.plan.code,
    membershipExpiresAt: getLegacyBillingExpirationDate(access.accessStatus, access.currentPeriodEndsAt),
    stripeCustomerId: access.stripeCustomerId,
    storageLimit: getResolvedLimit(access, "storage.bytes"),
    storageUsed: getResolvedUsage(access, "storage.bytes"),
    aiBalance: aiLimit < 0 ? -1 : Math.max(aiLimit - aiUsage, 0),
    billingStatus: access.billingStatus,
    accessStatus: access.accessStatus,
  }
}

function getCurrentMonthlyPeriodKey(now: Date) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`
}

async function resolveStore(store?: AccessStore): Promise<AccessStore> {
  if (store) {
    return store
  }

  const { prisma } = await import("../../lib/db.ts")
  return prisma as unknown as AccessStore
}
