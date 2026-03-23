import { BILLING_ADDONS, BILLING_PLANS, getAddonDefinition, getPlanDefinition } from "../lib/billing/catalog.ts"
import { createPlatformAuditLog } from "./platform-audit.ts"

type ContractRecord = {
  id: string
  organizationId: string
  planCode: string
  catalogVersion: number
  billingStatus: string
  accessStatus: string
  currentPeriodEndsAt?: Date | null
  addons?: Array<{
    addonCode: string
    isActive: boolean
  }>
}

type BillingAdminStore = {
  organizationSubscription: {
    findUnique: (args: {
      where: {
        organizationId: string
      }
      include?: {
        addons: true
      }
    }) => Promise<ContractRecord | null>
    upsert: (args: {
      where: {
        organizationId: string
      }
      update: Record<string, unknown>
      create: Record<string, unknown>
    }) => Promise<ContractRecord>
    update: (args: {
      where: {
        organizationId: string
      }
      data: Record<string, unknown>
    }) => Promise<ContractRecord>
  }
  organizationSubscriptionAddon: {
    deleteMany: (args: {
      where: {
        subscriptionId: string
      }
    }) => Promise<unknown>
    createMany: (args: {
      data: Array<{
        subscriptionId: string
        addonCode: string
        catalogVersion: number
        isActive: boolean
      }>
    }) => Promise<unknown>
  }
}

type BillingAdminDependencies = {
  store?: BillingAdminStore
  createPlatformAuditLog?: typeof createPlatformAuditLog
}

async function resolveStore(store?: BillingAdminStore): Promise<BillingAdminStore> {
  if (store) {
    return store
  }

  const { prisma } = await import("../lib/db.ts")
  return prisma as unknown as BillingAdminStore
}

async function ensureOrganizationSubscription(
  organizationId: string,
  fallbackPlanCode: string,
  store: BillingAdminStore
) {
  const existing = await store.organizationSubscription.findUnique({
    where: { organizationId },
    include: { addons: true },
  })

  if (existing) {
    return existing
  }

  const plan = getPlanDefinition(fallbackPlanCode) ?? BILLING_PLANS.starter ?? BILLING_PLANS.early
  if (!plan) {
    throw new Error("No se pudo resolver el plan base para la organización")
  }

  return await store.organizationSubscription.upsert({
    where: { organizationId },
    update: {},
    create: {
      organizationId,
      planCode: plan.code,
      catalogVersion: plan.version,
      billingStatus: "trial",
      accessStatus: "enabled",
    },
  })
}

function normalizeAddonCodes(addonCodes: string[]) {
  return [...new Set(addonCodes.filter((code) => Boolean(getAddonDefinition(code))))]
}

export async function setOrganizationPlanFromOps(
  input: {
    organizationId: string
    planCode: string
    actorUserId: string
    reason: string
  },
  dependencies: BillingAdminDependencies = {}
) {
  const store = await resolveStore(dependencies.store)
  const logAudit = dependencies.createPlatformAuditLog ?? createPlatformAuditLog
  const plan = getPlanDefinition(input.planCode)

  if (!plan) {
    throw new Error("Plan no válido")
  }

  const contract = await ensureOrganizationSubscription(input.organizationId, input.planCode, store)
  const updated = await store.organizationSubscription.update({
    where: { organizationId: input.organizationId },
    data: {
      planCode: plan.code,
      catalogVersion: plan.version,
      scheduledPlanCode: null,
      scheduledCatalogVersion: null,
    },
  })

  await logAudit({
    action: "organization.plan.updated",
    actorUserId: input.actorUserId,
    organizationId: input.organizationId,
    reason: input.reason,
    payload: {
      previousPlanCode: contract.planCode,
      nextPlanCode: plan.code,
    },
  })

  return updated
}

export async function setOrganizationAddonsFromOps(
  input: {
    organizationId: string
    addonCodes: string[]
    actorUserId: string
    reason: string
    fallbackPlanCode?: string
  },
  dependencies: BillingAdminDependencies = {}
) {
  const store = await resolveStore(dependencies.store)
  const logAudit = dependencies.createPlatformAuditLog ?? createPlatformAuditLog
  const contract = await ensureOrganizationSubscription(
    input.organizationId,
    input.fallbackPlanCode ?? "starter",
    store
  )
  const addonCodes = normalizeAddonCodes(input.addonCodes)

  await store.organizationSubscriptionAddon.deleteMany({
    where: {
      subscriptionId: contract.id,
    },
  })

  if (addonCodes.length > 0) {
    await store.organizationSubscriptionAddon.createMany({
      data: addonCodes.map((addonCode) => ({
        subscriptionId: contract.id,
        addonCode,
        catalogVersion: contract.catalogVersion,
        isActive: true,
      })),
    })
  }

  await logAudit({
    action: "organization.addons.updated",
    actorUserId: input.actorUserId,
    organizationId: input.organizationId,
    reason: input.reason,
    payload: {
      addonCodes,
    },
  })

  return addonCodes.map((code) => BILLING_ADDONS[code]).filter(Boolean)
}

export async function scheduleOrganizationPlanChangeFromOps(
  input: {
    organizationId: string
    actorUserId: string
    reason: string
    scheduledPlanCode: string | null
    fallbackPlanCode?: string
  },
  dependencies: BillingAdminDependencies = {}
) {
  const store = await resolveStore(dependencies.store)
  const logAudit = dependencies.createPlatformAuditLog ?? createPlatformAuditLog
  const contract = await ensureOrganizationSubscription(
    input.organizationId,
    input.fallbackPlanCode ?? "starter",
    store
  )

  const scheduledPlan = input.scheduledPlanCode ? getPlanDefinition(input.scheduledPlanCode) : null
  if (input.scheduledPlanCode && !scheduledPlan) {
    throw new Error("Plan programado no válido")
  }

  const updated = await store.organizationSubscription.update({
    where: { organizationId: input.organizationId },
    data: {
      scheduledPlanCode: scheduledPlan?.code ?? null,
      scheduledCatalogVersion: scheduledPlan?.version ?? null,
    },
  })

  await logAudit({
    action: scheduledPlan ? "organization.plan_change.scheduled" : "organization.plan_change.cleared",
    actorUserId: input.actorUserId,
    organizationId: input.organizationId,
    reason: input.reason,
    payload: {
      previousPlanCode: contract.planCode,
      scheduledPlanCode: scheduledPlan?.code ?? null,
    },
  })

  return updated
}
