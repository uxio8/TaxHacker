import { withFiscalStorageGuard } from "./storage.ts"

export type FiscalReviewRequestActorType = "client" | "advisor"
export type FiscalReviewRequestOwner = "client" | "advisor" | "shared"
export type FiscalReviewRequestStatus = "open" | "resolved"

type FiscalReviewRequestRecord = {
  id: string
  organizationId: string
  ownerScopeId: string
  fiscalDocumentId: string
  createdByUserId: string
  actorType: string
  owner: string
  message: string
  dueDate: Date | null
  status: string
  resolvedAt: Date | null
  resolvedByUserId: string | null
  createdAt: Date
  updatedAt: Date
}

type FiscalReviewRequestStore = {
  fiscalReviewRequest: {
    create(args: {
      data: {
        organizationId: string
        ownerScopeId: string
        fiscalDocumentId: string
        createdByUserId: string
        actorType: FiscalReviewRequestActorType
        owner: FiscalReviewRequestOwner
        message: string
        dueDate: Date | null
        status: FiscalReviewRequestStatus
      }
    }): Promise<FiscalReviewRequestRecord>
    update(args: {
      where: {
        id: string
      }
      data: {
        status: FiscalReviewRequestStatus
        resolvedAt: Date
        resolvedByUserId: string
      }
    }): Promise<FiscalReviewRequestRecord>
    findMany(args: {
      where: {
        ownerScopeId: string
        fiscalDocumentId: {
          in: string[]
        }
        status: "open"
      }
      orderBy: Array<Record<string, "asc" | "desc">>
    }): Promise<FiscalReviewRequestRecord[]>
  }
}

export type FiscalReviewRequest = {
  id: string
  organizationId: string
  ownerScopeId: string
  fiscalDocumentId: string
  createdByUserId: string
  actorType: FiscalReviewRequestActorType
  owner: FiscalReviewRequestOwner
  message: string
  dueDate: string | null
  status: FiscalReviewRequestStatus
  resolvedAt: string | null
  resolvedByUserId: string | null
  createdAt: string
  updatedAt: string
}

function trimToNull(value?: string | null) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function serializeDateOnly(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null
}

function parseOptionalDate(value?: string | Date | null) {
  if (!value) {
    return null
  }

  const parsed = value instanceof Date ? value : new Date(`${value}T00:00:00.000Z`)

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("dueDate debe ser una fecha válida")
  }

  return parsed
}

function isActorType(value: string): value is FiscalReviewRequestActorType {
  return value === "client" || value === "advisor"
}

function isOwner(value: string): value is FiscalReviewRequestOwner {
  return value === "client" || value === "advisor" || value === "shared"
}

function mapRecord(record: FiscalReviewRequestRecord): FiscalReviewRequest {
  return {
    id: record.id,
    organizationId: record.organizationId,
    ownerScopeId: record.ownerScopeId,
    fiscalDocumentId: record.fiscalDocumentId,
    createdByUserId: record.createdByUserId,
    actorType: isActorType(record.actorType) ? record.actorType : "advisor",
    owner: isOwner(record.owner) ? record.owner : "advisor",
    message: record.message,
    dueDate: record.dueDate?.toISOString().slice(0, 10) ?? null,
    status: record.status === "resolved" ? "resolved" : "open",
    resolvedAt: record.resolvedAt?.toISOString() ?? null,
    resolvedByUserId: record.resolvedByUserId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

async function resolveStore(store?: FiscalReviewRequestStore): Promise<FiscalReviewRequestStore> {
  if (store) {
    return store
  }

  const { prisma } = await import("../../lib/db.ts")
  return prisma as unknown as FiscalReviewRequestStore
}

export async function createFiscalReviewRequest(
  input: {
    organizationId: string
    ownerScopeId: string
    fiscalDocumentId: string
    createdByUserId: string
    actorType: FiscalReviewRequestActorType
    owner: FiscalReviewRequestOwner
    message: string
    dueDate?: string | Date | null
  },
  store?: FiscalReviewRequestStore
) {
  return withFiscalStorageGuard(async () => {
    const organizationId = trimToNull(input.organizationId)
    const ownerScopeId = trimToNull(input.ownerScopeId)
    const fiscalDocumentId = trimToNull(input.fiscalDocumentId)
    const createdByUserId = trimToNull(input.createdByUserId)
    const message = trimToNull(input.message)

    if (!organizationId || !ownerScopeId || !fiscalDocumentId || !createdByUserId || !message) {
      throw new Error("La incidencia fiscal requiere organizationId, ownerScopeId, fiscalDocumentId, autor y mensaje.")
    }

    const normalizedDueDate = parseOptionalDate(input.dueDate)
    const db = await resolveStore(store)
    const existingRequests = await listOpenFiscalReviewRequestsByDocumentIds(
      ownerScopeId,
      [fiscalDocumentId],
      store
    )
    const duplicate = existingRequests.find((request) => {
      return (
        request.organizationId === organizationId &&
        request.createdByUserId === createdByUserId &&
        request.actorType === input.actorType &&
        request.owner === input.owner &&
        request.message === message &&
        request.dueDate === serializeDateOnly(normalizedDueDate)
      )
    })

    if (duplicate) {
      return duplicate
    }

    const record = await db.fiscalReviewRequest.create({
      data: {
        organizationId,
        ownerScopeId,
        fiscalDocumentId,
        createdByUserId,
        actorType: input.actorType,
        owner: input.owner,
        message,
        dueDate: normalizedDueDate,
        status: "open",
      },
    })

    return mapRecord(record)
  })
}

export async function resolveFiscalReviewRequest(
  input: {
    requestId: string
    resolvedByUserId: string
  },
  store?: FiscalReviewRequestStore
) {
  return withFiscalStorageGuard(async () => {
    const requestId = trimToNull(input.requestId)
    const resolvedByUserId = trimToNull(input.resolvedByUserId)

    if (!requestId || !resolvedByUserId) {
      throw new Error("requestId y resolvedByUserId son obligatorios para resolver la incidencia.")
    }

    const db = await resolveStore(store)
    const record = await db.fiscalReviewRequest.update({
      where: {
        id: requestId,
      },
      data: {
        status: "resolved",
        resolvedAt: new Date(),
        resolvedByUserId,
      },
    })

    return mapRecord(record)
  })
}

export async function listOpenFiscalReviewRequestsByDocumentIds(
  ownerScopeId: string,
  fiscalDocumentIds: string[],
  store?: FiscalReviewRequestStore
) {
  return withFiscalStorageGuard(async () => {
    const normalizedOwnerScopeId = trimToNull(ownerScopeId)
    const normalizedDocumentIds = fiscalDocumentIds.filter((value): value is string => Boolean(trimToNull(value)))

    if (!normalizedOwnerScopeId || normalizedDocumentIds.length === 0) {
      return []
    }

    const db = await resolveStore(store)
    const records = await db.fiscalReviewRequest.findMany({
      where: {
        ownerScopeId: normalizedOwnerScopeId,
        status: "open",
        fiscalDocumentId: {
          in: normalizedDocumentIds,
        },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    })

    return records.map(mapRecord)
  })
}
