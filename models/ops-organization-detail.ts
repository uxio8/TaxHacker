import { buildReadinessSummary } from "../lib/readiness.ts"
import { listRecentBillingEventsByOrganization } from "./billing/events.ts"
import { listRecentPlatformAuditLogs } from "./platform-audit.ts"
import { getOpsOrganizationSupport } from "./ops-support.ts"
import { listSupportAccessSessions } from "./support-access.ts"

type SnapshotRecord = {
  id: string
  name: string
  createdAt: Date
  subscription: {
    planCode: string
    catalogVersion: number
    billingStatus: string
    accessStatus: string
    currentPeriodEndsAt: Date | null
    scheduledPlanCode: string | null
    scheduledCatalogVersion: number | null
    stripeCustomerId?: string | null
    stripeSubscriptionId?: string | null
    cancelAtPeriodEnd?: boolean
    addons: Array<{
      addonCode: string
      isActive: boolean
      expiresAt: Date | null
      scheduledRemovalAt?: Date | null
    }>
  } | null
  memberships: Array<{
    id: string
    userId: string
    role: string
    user: {
      id: string
      email: string | null
      name: string | null
      businessAddress?: string | null
    } | null
  }>
  invitations: Array<{
    id: string
    email?: string
    emailNormalized?: string
    role: string
    token: string
    expiresAt: Date
    revokedAt: Date | null
    acceptedAt: Date | null
  }>
  usageRecords: Array<{
    metricKey: string
    quantity: number
    periodKey: string
  }>
  activeOverrides: Array<{
    id: string
    type: string
    key: string
    accessStatusValue?: string | null
    expiresAt: Date | null
  }>
  hasUnsortedBacklog: boolean
}

type OpsOrganizationDetailDependencies = {
  getOrganizationSnapshot?: (organizationId: string) => Promise<SnapshotRecord | null>
  getAttentionSummary?: (input: {
    organizationId: string
    organizationName: string
    userId: string
    businessAddress?: string | null
  }) => Promise<{
    readiness: {
      isReady: boolean
      completedCount: number
      totalCount: number
      nextStep: {
        key: string
        title: string
        href: string
      } | null
    }
    counts: Record<string, number> & {
      needsAction?: number
      blocked?: number
    }
    topItem: {
      title: string
      href: string
      state?: string
    } | null
    items: Array<{
      state?: string
      title?: string
      href?: string
    }>
  }>
  listRecentPlatformAuditLogs?: typeof listRecentPlatformAuditLogs
  listRecentBillingEventsByOrganization?: typeof listRecentBillingEventsByOrganization
  getOpsOrganizationSupport?: typeof getOpsOrganizationSupport
  listSupportAccessSessions?: typeof listSupportAccessSessions
}

export type OpsOrganizationHealthSummary = {
  statusTone: "healthy" | "warning" | "critical"
  blockers: Array<{
    title: string
    href: string | null
    kind: "attention" | "readiness" | "billing" | "access" | "backlog"
  }>
  counters: {
    blocked: number
    needsAction: number
    supportSessions: number
    openInvitations: number
  }
}

export function buildOpsOrganizationHealthSummary(input: {
  readiness: {
    isReady: boolean
    completedCount: number
    totalCount: number
    nextStep: {
      key: string
      title: string
      href: string
    } | null
  }
  attention: {
    counts: {
      needsAction: number
      blocked: number
    }
    topItem: {
      title: string
      href: string
    } | null
  }
  activeSupportSessions: number
  openInvitationCount: number
  billingStatus: string
  accessStatus: string
  hasUnsortedBacklog: boolean
}): OpsOrganizationHealthSummary {
  const blockers: OpsOrganizationHealthSummary["blockers"] = []

  if (input.attention.counts.blocked > 0 && input.attention.topItem) {
    blockers.push({
      title: input.attention.topItem.title,
      href: input.attention.topItem.href,
      kind: "attention",
    })
  }

  if (!input.readiness.isReady && input.readiness.nextStep) {
    blockers.push({
      title: input.readiness.nextStep.title,
      href: input.readiness.nextStep.href,
      kind: "readiness",
    })
  }

  if (input.accessStatus === "restricted" || input.accessStatus === "suspended") {
    blockers.push({
      title: `Acceso ${input.accessStatus === "suspended" ? "suspendido" : "restringido"}`,
      href: null,
      kind: "access",
    })
  } else if (input.billingStatus === "past_due" || input.billingStatus === "cancelled") {
    blockers.push({
      title: "Contrato con incidencia de cobro",
      href: "/settings/billing",
      kind: "billing",
    })
  }

  if (input.hasUnsortedBacklog && blockers.every((item) => item.kind !== "attention")) {
    blockers.push({
      title: "Quedan documentos sin revisar",
      href: "/unsorted",
      kind: "backlog",
    })
  }

  let statusTone: OpsOrganizationHealthSummary["statusTone"] = "healthy"
  if (input.accessStatus === "restricted" || input.accessStatus === "suspended") {
    statusTone = "critical"
  } else if (
    blockers.length > 0
    || input.attention.counts.needsAction > 0
    || input.activeSupportSessions > 0
    || input.openInvitationCount > 0
  ) {
    statusTone = "warning"
  }

  return {
    statusTone,
    blockers,
    counters: {
      blocked: input.attention.counts.blocked,
      needsAction: input.attention.counts.needsAction,
      supportSessions: input.activeSupportSessions,
      openInvitations: input.openInvitationCount,
    },
  }
}

export async function getOpsOrganizationDetail(
  organizationId: string,
  dependencies: OpsOrganizationDetailDependencies = {}
) {
  const loadSnapshot = dependencies.getOrganizationSnapshot ?? getOrganizationSnapshot
  const snapshot = await loadSnapshot(organizationId)

  if (!snapshot) {
    return null
  }

  const primaryMembership = snapshot.memberships.find((membership) => membership.role === "owner" && membership.user)
    ?? snapshot.memberships.find((membership) => membership.user)
    ?? null

  const attention = primaryMembership?.user
    ? normalizeOpsAttentionSummary(
        await (dependencies.getAttentionSummary ?? getDefaultAttentionSummary)({
        organizationId: snapshot.id,
        organizationName: snapshot.name,
        userId: primaryMembership.user.id,
        businessAddress: primaryMembership.user.businessAddress ?? null,
        })
      )
    : {
        readiness: buildReadinessSummary({
          organizationName: snapshot.name,
          businessAddress: null,
          llmConfigured: false,
          fiscalProfileReady: false,
          backupReady: false,
          selfHosted: false,
        }),
        counts: {
          needsAction: snapshot.hasUnsortedBacklog ? 1 : 0,
          blocked: 0,
        },
        topItem: snapshot.hasUnsortedBacklog
          ? { title: "Quedan documentos sin revisar", href: "/unsorted" }
          : null,
        items: [],
      }

  const [support, recentLogs, recentBillingEvents] = await Promise.all([
    dependencies.getOpsOrganizationSupport
      ? dependencies.getOpsOrganizationSupport(organizationId)
      : getOpsOrganizationSupport(organizationId, {
          listSupportAccessSessions: dependencies.listSupportAccessSessions,
          listRecentPlatformAuditLogs: dependencies.listRecentPlatformAuditLogs,
        }),
    (dependencies.listRecentPlatformAuditLogs ?? listRecentPlatformAuditLogs)({
      organizationId,
      limit: 20,
    }),
    (dependencies.listRecentBillingEventsByOrganization ?? listRecentBillingEventsByOrganization)(organizationId, 10),
  ])

  return {
    organization: {
      id: snapshot.id,
      name: snapshot.name,
      createdAt: snapshot.createdAt,
    },
    contract: snapshot.subscription,
    members: snapshot.memberships,
    invitations: snapshot.invitations,
    usage: snapshot.usageRecords,
    support,
    audit: {
      recentLogs,
      recentBillingEvents,
    },
    health: buildOpsOrganizationHealthSummary({
      readiness: attention.readiness,
      attention,
      activeSupportSessions: support.activeSessions.length,
      openInvitationCount: snapshot.invitations.filter((invitation) => !invitation.revokedAt && !invitation.acceptedAt).length,
      billingStatus: snapshot.subscription?.billingStatus ?? "trial",
      accessStatus: resolveEffectiveAccessStatus(snapshot.subscription?.accessStatus ?? "enabled", snapshot.activeOverrides),
      hasUnsortedBacklog: snapshot.hasUnsortedBacklog,
    }),
    flags: {
      hasUnsortedBacklog: snapshot.hasUnsortedBacklog,
      hasActiveAccessOverride: snapshot.activeOverrides.some((override) => override.type === "access_status"),
    },
  }
}

async function getDefaultAttentionSummary(input: {
  organizationId: string
  organizationName: string
  userId: string
  businessAddress?: string | null
}) {
  const attentionModule = await import("./attention.ts")
  return attentionModule.getAttentionSummary(input)
}

function normalizeOpsAttentionSummary(input: {
  readiness: {
    isReady: boolean
    completedCount: number
    totalCount: number
    nextStep: {
      key: string
      title: string
      href: string
    } | null
  }
  counts: Record<string, number> & {
    needsAction?: number
    blocked?: number
  }
  topItem: {
    title: string
    href: string
    state?: string
  } | null
  items: Array<{
    state?: string
    title?: string
    href?: string
  }>
}) {
  const blocked = typeof input.counts.blocked === "number"
    ? input.counts.blocked
    : input.items.filter((item) => item.state === "blocked").length
  const needsAction = typeof input.counts.needsAction === "number"
    ? input.counts.needsAction
    : input.items.length

  return {
    readiness: input.readiness,
    counts: {
      blocked,
      needsAction,
    },
    topItem: input.topItem
      ? {
          title: input.topItem.title,
          href: input.topItem.href,
        }
      : null,
  }
}

function resolveEffectiveAccessStatus(
  currentAccessStatus: string,
  overrides: SnapshotRecord["activeOverrides"]
) {
  const activeOverride = overrides.find((override) => override.type === "access_status" && override.accessStatusValue)
  return activeOverride?.accessStatusValue ?? currentAccessStatus
}

async function getOrganizationSnapshot(organizationId: string): Promise<SnapshotRecord | null> {
  const { prisma } = await import("../lib/db.ts")
  const now = new Date()

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      subscription: {
        include: {
          addons: true,
        },
      },
      memberships: {
        orderBy: { createdAt: "asc" },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              businessAddress: true,
            },
          },
        },
      },
      invitations: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      usageRecords: {
        where: {
          periodKey: "current",
        },
      },
      overrides: {
        where: {
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        orderBy: { createdAt: "desc" },
      },
      files: {
        where: {
          isReviewed: false,
        },
        select: {
          id: true,
        },
        take: 1,
      },
    },
  })

  if (!organization) {
    return null
  }

  return {
    id: organization.id,
    name: organization.name,
    createdAt: organization.createdAt,
    subscription: organization.subscription
      ? {
          planCode: organization.subscription.planCode,
          catalogVersion: organization.subscription.catalogVersion,
          billingStatus: organization.subscription.billingStatus,
          accessStatus: organization.subscription.accessStatus,
          currentPeriodEndsAt: organization.subscription.currentPeriodEndsAt,
          scheduledPlanCode: organization.subscription.scheduledPlanCode,
          scheduledCatalogVersion: organization.subscription.scheduledCatalogVersion,
          stripeCustomerId: organization.subscription.stripeCustomerId,
          stripeSubscriptionId: organization.subscription.stripeSubscriptionId,
          cancelAtPeriodEnd: organization.subscription.cancelAtPeriodEnd,
          addons: organization.subscription.addons.map((addon) => ({
            addonCode: addon.addonCode,
            isActive: addon.isActive,
            expiresAt: addon.expiresAt,
            scheduledRemovalAt: addon.scheduledRemovalAt,
          })),
        }
      : null,
    memberships: organization.memberships,
    invitations: organization.invitations,
    usageRecords: organization.usageRecords,
    activeOverrides: organization.overrides.map((override) => ({
      id: override.id,
      type: override.type,
      key: override.key,
      accessStatusValue: override.accessStatusValue,
      expiresAt: override.expiresAt,
    })),
    hasUnsortedBacklog: organization.files.length > 0,
  }
}
