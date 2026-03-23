export const FISCAL_AUDIT_SCHEMA_VERSION = 1 as const

export const FISCAL_AUDIT_EVENT_FISCAL_DOCUMENT_EDITED = "fiscal_document_edited" as const
export const FISCAL_AUDIT_EVENT_FISCAL_DOCUMENT_EDIT_BLOCKED =
  "fiscal_document_edit_blocked" as const
export const FISCAL_AUDIT_EVENT_COUNTERPARTY_AUTO_LINKED =
  "counterparty_auto_linked" as const
export const FISCAL_AUDIT_EVENT_COUNTERPARTY_CONFIRMED =
  "counterparty_confirmed" as const
export const FISCAL_AUDIT_EVENT_COUNTERPARTY_REJECTED =
  "counterparty_rejected" as const
export const FISCAL_AUDIT_EVENT_COUNTERPARTY_CREATED_AND_LINKED =
  "counterparty_created_and_linked" as const
export const FISCAL_AUDIT_EVENT_COUNTERPARTY_KEPT_IN_REVIEW =
  "counterparty_kept_in_review" as const
export const FISCAL_AUDIT_EVENT_PERIOD_CLOSED = "period_closed" as const
export const FISCAL_AUDIT_EVENT_PERIOD_REOPENED = "period_reopened" as const

const FISCAL_AUDIT_EVENTS = [
  FISCAL_AUDIT_EVENT_FISCAL_DOCUMENT_EDITED,
  FISCAL_AUDIT_EVENT_FISCAL_DOCUMENT_EDIT_BLOCKED,
  FISCAL_AUDIT_EVENT_COUNTERPARTY_AUTO_LINKED,
  FISCAL_AUDIT_EVENT_COUNTERPARTY_CONFIRMED,
  FISCAL_AUDIT_EVENT_COUNTERPARTY_REJECTED,
  FISCAL_AUDIT_EVENT_COUNTERPARTY_CREATED_AND_LINKED,
  FISCAL_AUDIT_EVENT_COUNTERPARTY_KEPT_IN_REVIEW,
  FISCAL_AUDIT_EVENT_PERIOD_CLOSED,
  FISCAL_AUDIT_EVENT_PERIOD_REOPENED,
] as const

type FiscalAuditEventName = (typeof FISCAL_AUDIT_EVENTS)[number]
type FiscalAuditOrder = "asc" | "desc"

export type FiscalAuditActor = {
  type: string
  id: string | null
}

export type FiscalAuditPayload = {
  schema_version: typeof FISCAL_AUDIT_SCHEMA_VERSION
  event: FiscalAuditEventName
  actor: FiscalAuditActor
  reason: string | null
  details?: Record<string, unknown> | null
  references: {
    owner_scope_id: string
    fiscal_period_id: string | null
    fiscal_document_id: string | null
  }
}

export type FiscalAuditEvent = {
  id: string
  ownerScopeId: string
  fiscalPeriodId: string | null
  fiscalDocumentId: string | null
  event: FiscalAuditEventName
  schemaVersion: typeof FISCAL_AUDIT_SCHEMA_VERSION
  actor: FiscalAuditActor
  reason: string | null
  details: Record<string, unknown> | null
  occurredAt: string
  createdAt: string
  payload: FiscalAuditPayload
}

export type AppendFiscalAuditEventInput = {
  event: string
  actor: {
    type: string
    id?: string | null
  }
  details?: Record<string, unknown> | null
  fiscalPeriodId?: string | null
  fiscalDocumentId?: string | null
  reason?: string | null
  occurredAt?: string | Date | null
}

export type ListFiscalAuditEventsInput = {
  event?: string | null
  fiscalPeriodId?: string | null
  fiscalDocumentId?: string | null
  limit?: number
  order?: FiscalAuditOrder | null
}

type FiscalAuditLogRecord = {
  id: string
  ownerScopeId: string
  fiscalPeriodId: string | null
  fiscalDocumentId: string | null
  event: string
  schemaVersion: number
  payload: unknown
  occurredAt: Date
  createdAt: Date
}

type FiscalAuditLogStore = {
  fiscalAuditLog: {
    create(args: {
      data: {
        ownerScopeId: string
        fiscalPeriodId: string | null
        fiscalDocumentId: string | null
        event: FiscalAuditEventName
        schemaVersion: typeof FISCAL_AUDIT_SCHEMA_VERSION
        payload: FiscalAuditPayload
        occurredAt: Date
      }
    }): Promise<FiscalAuditLogRecord>
    findMany(args: {
      where: {
        ownerScopeId: string
        event?: FiscalAuditEventName
        fiscalPeriodId?: string
        fiscalDocumentId?: string
      }
      orderBy: [{ occurredAt: FiscalAuditOrder }, { id: FiscalAuditOrder }]
      take?: number
    }): Promise<FiscalAuditLogRecord[]>
  }
}

function trimToNull(value?: string | null): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function serializeDateTime(value: Date): string {
  return value.toISOString()
}

function normalizeOwnerScopeId(ownerScopeId: string): string {
  const normalized = trimToNull(ownerScopeId)

  if (!normalized) {
    throw new Error("ownerScopeId es obligatorio para operar con el audit log fiscal")
  }

  return normalized
}

function normalizeEvent(event: string): FiscalAuditEventName {
  const normalized = trimToNull(event)

  if (!normalized || !FISCAL_AUDIT_EVENTS.includes(normalized as FiscalAuditEventName)) {
    throw new Error(`FiscalAuditLog V1 no admite event=${normalized ?? ""}`)
  }

  return normalized as FiscalAuditEventName
}

function normalizeActor(actor: AppendFiscalAuditEventInput["actor"]): FiscalAuditActor {
  const type = trimToNull(actor?.type)

  if (!type) {
    throw new Error("actor.type es obligatorio")
  }

  return {
    type,
    id: trimToNull(actor.id),
  }
}

function normalizeOccurredAt(value?: string | Date | null): Date {
  if (!value) {
    return new Date()
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error("occurredAt debe ser una fecha valida")
    }

    return new Date(value.getTime())
  }

  const normalized = trimToNull(value)

  if (!normalized) {
    return new Date()
  }

  const parsed = new Date(normalized)

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("occurredAt debe ser una fecha ISO valida")
  }

  return parsed
}

function normalizeLimit(limit?: number): number | undefined {
  if (typeof limit === "undefined") {
    return undefined
  }

  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("limit debe ser un entero positivo")
  }

  return limit
}

function normalizeOrder(order?: FiscalAuditOrder | null): FiscalAuditOrder {
  if (!order) {
    return "desc"
  }

  if (order !== "asc" && order !== "desc") {
    throw new Error(`order no soportado: ${order}`)
  }

  return order
}

function toPayloadRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("payload fiscal corrupto")
  }

  return value as Record<string, unknown>
}

function readPayload(record: FiscalAuditLogRecord): FiscalAuditPayload {
  const payload = toPayloadRecord(record.payload)
  const actor = toPayloadRecord(payload.actor)
  const references = toPayloadRecord(payload.references)
  const event = normalizeEvent(String(payload.event ?? ""))
  const actorType = trimToNull(String(actor.type ?? ""))
  const details =
    typeof payload.details === "undefined" || payload.details === null
      ? null
      : toPayloadRecord(payload.details)

  if (payload.schema_version !== FISCAL_AUDIT_SCHEMA_VERSION) {
    throw new Error("FiscalAuditLog V1 solo admite schema_version=1")
  }

  if (!actorType) {
    throw new Error("payload.actor.type es obligatorio")
  }

  if (trimToNull(String(references.owner_scope_id ?? "")) !== record.ownerScopeId) {
    throw new Error("payload.references.owner_scope_id no coincide con el registro")
  }

  return {
    schema_version: FISCAL_AUDIT_SCHEMA_VERSION,
    event,
    actor: {
      type: actorType,
      id: trimToNull(typeof actor.id === "string" ? actor.id : null),
    },
    reason: trimToNull(typeof payload.reason === "string" ? payload.reason : null),
    details,
    references: {
      owner_scope_id: record.ownerScopeId,
      fiscal_period_id: trimToNull(
        typeof references.fiscal_period_id === "string" ? references.fiscal_period_id : null
      ),
      fiscal_document_id: trimToNull(
        typeof references.fiscal_document_id === "string" ? references.fiscal_document_id : null
      ),
    },
  }
}

function buildPayload(
  ownerScopeId: string,
  input: AppendFiscalAuditEventInput
): { event: FiscalAuditEventName; payload: FiscalAuditPayload } {
  const event = normalizeEvent(input.event)
  const actor = normalizeActor(input.actor)
  const fiscalPeriodId = trimToNull(input.fiscalPeriodId)
  const fiscalDocumentId = trimToNull(input.fiscalDocumentId)
  const reason = trimToNull(input.reason)
  const details =
    input.details && typeof input.details === "object" && !Array.isArray(input.details)
      ? input.details
      : null

  return {
    event,
    payload: {
      schema_version: FISCAL_AUDIT_SCHEMA_VERSION,
      event,
      actor,
      reason,
      details,
      references: {
        owner_scope_id: ownerScopeId,
        fiscal_period_id: fiscalPeriodId,
        fiscal_document_id: fiscalDocumentId,
      },
    },
  }
}

function mapRecordToFiscalAuditEvent(record: FiscalAuditLogRecord): FiscalAuditEvent {
  if (record.schemaVersion !== FISCAL_AUDIT_SCHEMA_VERSION) {
    throw new Error("FiscalAuditLog V1 solo admite schemaVersion=1")
  }

  const payload = readPayload(record)

  if (payload.event !== normalizeEvent(record.event)) {
    throw new Error("payload.event no coincide con event")
  }

  return {
    id: record.id,
    ownerScopeId: record.ownerScopeId,
    fiscalPeriodId: record.fiscalPeriodId,
    fiscalDocumentId: record.fiscalDocumentId,
    event: payload.event,
    schemaVersion: FISCAL_AUDIT_SCHEMA_VERSION,
    actor: payload.actor,
    reason: payload.reason,
    details: payload.details ?? null,
    occurredAt: serializeDateTime(record.occurredAt),
    createdAt: serializeDateTime(record.createdAt),
    payload,
  }
}

async function resolveStore(store?: FiscalAuditLogStore): Promise<FiscalAuditLogStore> {
  if (store) {
    return store
  }

  const { prisma } = await import("../../lib/db.ts")
  return prisma as unknown as FiscalAuditLogStore
}

export async function appendFiscalAuditEvent(
  ownerScopeId: string,
  input: AppendFiscalAuditEventInput,
  store?: FiscalAuditLogStore
): Promise<FiscalAuditEvent> {
  const normalizedOwnerScopeId = normalizeOwnerScopeId(ownerScopeId)
  const { event, payload } = buildPayload(normalizedOwnerScopeId, input)
  const db = await resolveStore(store)

  const record = await db.fiscalAuditLog.create({
    data: {
      ownerScopeId: normalizedOwnerScopeId,
      fiscalPeriodId: payload.references.fiscal_period_id,
      fiscalDocumentId: payload.references.fiscal_document_id,
      event,
      schemaVersion: FISCAL_AUDIT_SCHEMA_VERSION,
      payload,
      occurredAt: normalizeOccurredAt(input.occurredAt),
    },
  })

  return mapRecordToFiscalAuditEvent(record)
}

export async function listFiscalAuditEvents(
  ownerScopeId: string,
  input?: ListFiscalAuditEventsInput,
  store?: FiscalAuditLogStore
): Promise<FiscalAuditEvent[]> {
  const normalizedOwnerScopeId = normalizeOwnerScopeId(ownerScopeId)
  const event = input?.event ? normalizeEvent(input.event) : undefined
  const fiscalPeriodId = trimToNull(input?.fiscalPeriodId)
  const fiscalDocumentId = trimToNull(input?.fiscalDocumentId)
  const order = normalizeOrder(input?.order)
  const db = await resolveStore(store)

  const records = await db.fiscalAuditLog.findMany({
    where: {
      ownerScopeId: normalizedOwnerScopeId,
      ...(event ? { event } : {}),
      ...(fiscalPeriodId ? { fiscalPeriodId } : {}),
      ...(fiscalDocumentId ? { fiscalDocumentId } : {}),
    },
    orderBy: [{ occurredAt: order }, { id: order }],
    take: normalizeLimit(input?.limit),
  })

  return records.map(mapRecordToFiscalAuditEvent)
}
