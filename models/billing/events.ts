type BillingEventStore = {
  billingEvent: {
    create: (args: {
      data: {
        organizationId: string
        provider: string
        eventType: string
        externalEventId?: string | null
        payload: unknown
        processedAt?: Date | null
      }
    }) => Promise<unknown>
    findMany: (args: {
      where: {
        organizationId: string
      }
      orderBy: {
        createdAt: "asc" | "desc"
      }
      take: number
    }) => Promise<Array<{
      id: string
      eventType: string
      externalEventId: string | null
      processedAt: Date | null
      createdAt: Date
    }>>
  }
}

export async function recordBillingEvent(
  input: {
    organizationId: string
    provider: string
    eventType: string
    externalEventId?: string | null
    payload: unknown
    processedAt?: Date | null
  },
  store?: BillingEventStore
) {
  const db = await resolveStore(store)

  try {
    await db.billingEvent.create({
      data: {
        organizationId: input.organizationId,
        provider: input.provider,
        eventType: input.eventType,
        externalEventId: input.externalEventId ?? null,
        payload: input.payload,
        processedAt: input.processedAt ?? null,
      },
    })
  } catch (error) {
    if (!isDuplicateError(error, input.externalEventId)) {
      throw error
    }
  }
}

export async function listRecentBillingEventsByOrganization(
  organizationId: string,
  take = 10,
  store?: BillingEventStore
) {
  const db = await resolveStore(store)
  return db.billingEvent.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take,
  })
}

function isDuplicateError(error: unknown, externalEventId?: string | null) {
  if (!externalEventId) {
    return false
  }

  return (
    typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "P2002"
  )
}

async function resolveStore(store?: BillingEventStore): Promise<BillingEventStore> {
  if (store) {
    return store
  }

  const { prisma } = await import("../../lib/db.ts")
  return prisma as unknown as BillingEventStore
}
