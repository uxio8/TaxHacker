type RawOpsOrganizationRow = {
  id: string
  name: string
  createdAt: Date
  subscription: {
    planCode: string
    billingStatus: string
    accessStatus: string
    stripeCustomerId: string | null
    currentPeriodEndsAt: Date | null
    addons: Array<{
      addonCode: string
      isActive: boolean
    }>
  } | null
  usageRecords: Array<{
    metricKey: string
    quantity: number
    periodKey: string
  }>
  memberships: Array<{
    id: string
    userId: string
    role: string
    user: {
      id: string
      name: string | null
      email: string
    } | null
  }>
  supportAccessSessions: Array<{
    id: string
    userId: string
    mode: string
    expiresAt: Date
    user: {
      id: string
      name: string | null
      email: string
    } | null
  }>
  overrides: Array<{
    type: string
    key: string
    accessStatusValue: string | null
    expiresAt: Date | null
  }>
  files: Array<{
    id: string
  }>
}

type OpsStore = {
  organization: {
    findMany: (args: {
      where?: {
        OR?: Array<{
          name?: {
            contains: string
            mode: "insensitive"
          }
          memberships?: {
            some: {
              user: {
                email: {
                  contains: string
                  mode: "insensitive"
                }
              }
            }
          }
        }>
      }
      orderBy: {
        createdAt: "asc" | "desc"
      }
      include: {
        subscription: {
          include: {
            addons: true
          }
        }
        usageRecords: {
          where: {
            periodKey: string
          }
        }
        memberships: {
          include: {
            user: {
              select: {
                id: true
                name: true
                email: true
              }
            }
          }
        }
        supportAccessSessions: {
          where: {
            revokedAt: null
            expiresAt: {
              gt: Date
            }
          }
          include: {
            user: {
              select: {
                id: true
                name: true
                email: true
              }
            }
          }
          orderBy: {
            expiresAt: "asc" | "desc"
          }
        }
        overrides: {
          where: {
            OR: Array<{
              expiresAt: null
            } | {
              expiresAt: {
                gt: Date
              }
            }>
          }
        }
        files: {
          where: {
            isReviewed: false
          }
          select: {
            id: true
          }
          take: number
        }
      }
    }) => Promise<RawOpsOrganizationRow[]>
  }
  organizationOverride: {
    deleteMany: (args: {
      where: {
        organizationId: string
        type: "access_status"
        key: string
        reason: string
      }
    }) => Promise<unknown>
    create: (args: {
      data: {
        organizationId: string
        type: "access_status"
        key: string
        accessStatusValue: "restricted" | "suspended"
        reason: string
        createdByUserId: string
      }
    }) => Promise<unknown>
  }
}

export type OpsOrganizationListItem = RawOpsOrganizationRow & {
  effectiveAccessStatus: string
  activeAddonCodes: string[]
  hasActiveSupport: boolean
  hasUnsortedBacklog: boolean
}

export type OpsDashboardSummary = {
  total: number
  trial: number
  pastDue: number
  restrictedOrSuspended: number
  supportActive: number
  reviewBacklog: number
}

const OPS_ACCESS_OVERRIDE_REASON = "platform-ops-access"

export async function listOrganizationsForOps(
  input: {
    search?: string
    planCode?: string
    billingStatus?: string
    accessStatus?: string
    support?: "all" | "active"
    backlog?: "all" | "with_backlog"
  } = {},
  store?: OpsStore
) {
  const db = await resolveStore(store)
  const now = new Date()
  const rows = await db.organization.findMany({
    where: input.search?.trim()
      ? {
          OR: [
            {
              name: {
                contains: input.search.trim(),
                mode: "insensitive",
              },
            },
            {
              memberships: {
                some: {
                  user: {
                    email: {
                      contains: input.search.trim(),
                      mode: "insensitive",
                    },
                  },
                },
              },
            },
          ],
        }
      : undefined,
    orderBy: {
      createdAt: "desc",
    },
    include: {
      subscription: {
        include: {
          addons: true,
        },
      },
      usageRecords: {
        where: {
          periodKey: "current",
        },
      },
      memberships: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      supportAccessSessions: {
        where: {
          revokedAt: null,
          expiresAt: {
            gt: now,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          expiresAt: "asc",
        },
      },
      overrides: {
        where: {
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
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

  return rows
    .map((row) => enrichOrganizationRow(row))
    .filter((row) => {
      if (input.planCode && row.subscription?.planCode !== input.planCode) {
        return false
      }

      if (input.billingStatus && (row.subscription?.billingStatus ?? "trial") !== input.billingStatus) {
        return false
      }

      if (input.accessStatus && row.effectiveAccessStatus !== input.accessStatus) {
        return false
      }

      if (input.support === "active" && !row.hasActiveSupport) {
        return false
      }

      if (input.backlog === "with_backlog" && !row.hasUnsortedBacklog) {
        return false
      }

      return true
    })
}

export function summarizeOrganizationsForOps(organizations: OpsOrganizationListItem[]): OpsDashboardSummary {
  return organizations.reduce<OpsDashboardSummary>(
    (summary, organization) => {
      summary.total += 1

      const billingStatus = organization.subscription?.billingStatus ?? "trial"
      if (billingStatus === "trial") {
        summary.trial += 1
      }

      if (billingStatus === "past_due") {
        summary.pastDue += 1
      }

      if (organization.effectiveAccessStatus === "restricted" || organization.effectiveAccessStatus === "suspended") {
        summary.restrictedOrSuspended += 1
      }

      if (organization.hasActiveSupport) {
        summary.supportActive += 1
      }

      if (organization.hasUnsortedBacklog) {
        summary.reviewBacklog += 1
      }

      return summary
    },
    {
      total: 0,
      trial: 0,
      pastDue: 0,
      restrictedOrSuspended: 0,
      supportActive: 0,
      reviewBacklog: 0,
    }
  )
}

export async function setOrganizationAccessOverride(
  input: {
    organizationId: string
    actorUserId: string
    accessStatus: "restricted" | "suspended" | null
    reason: string
  },
  store?: OpsStore
) {
  const db = await resolveStore(store)

  await db.organizationOverride.deleteMany({
    where: {
      organizationId: input.organizationId,
      type: "access_status",
      key: "global",
      reason: OPS_ACCESS_OVERRIDE_REASON,
    },
  })

  if (input.accessStatus) {
    await db.organizationOverride.create({
      data: {
        organizationId: input.organizationId,
        type: "access_status",
        key: "global",
        accessStatusValue: input.accessStatus,
        reason: OPS_ACCESS_OVERRIDE_REASON,
        createdByUserId: input.actorUserId,
      },
    })
  }
}

function enrichOrganizationRow(row: RawOpsOrganizationRow): OpsOrganizationListItem {
  const accessOverride = row.overrides.find((override) => override.type === "access_status" && override.accessStatusValue)

  return {
    ...row,
    effectiveAccessStatus: accessOverride?.accessStatusValue ?? row.subscription?.accessStatus ?? "enabled",
    activeAddonCodes:
      row.subscription?.addons.filter((addon) => addon.isActive).map((addon) => addon.addonCode) ?? [],
    hasActiveSupport: row.supportAccessSessions.length > 0,
    hasUnsortedBacklog: row.files.length > 0,
  }
}

async function resolveStore(store?: OpsStore): Promise<OpsStore> {
  if (store) {
    return store
  }

  const { prisma } = await import("../lib/db.ts")
  return prisma as unknown as OpsStore
}
