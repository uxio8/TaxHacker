import assert from "node:assert/strict"
import test from "node:test"

import {
  FISCAL_AUDIT_EVENT_COUNTERPARTY_AUTO_LINKED,
  FISCAL_AUDIT_EVENT_FISCAL_DOCUMENT_EDITED,
  FISCAL_AUDIT_EVENT_PERIOD_CLOSED,
  FISCAL_AUDIT_EVENT_PERIOD_REOPENED,
  appendFiscalAuditEvent,
  listFiscalAuditEvents,
} from "../../../models/fiscal/audit-log.ts"

function createAuditRecord(overrides = {}) {
  return {
    id: "audit_001",
    ownerScopeId: "fp_1",
    fiscalPeriodId: null,
    fiscalDocumentId: null,
    event: FISCAL_AUDIT_EVENT_FISCAL_DOCUMENT_EDITED,
    schemaVersion: 1,
    payload: {
      schema_version: 1,
      event: FISCAL_AUDIT_EVENT_FISCAL_DOCUMENT_EDITED,
      actor: {
        type: "user",
        id: "user_1",
      },
      reason: "Correccion manual",
      details: null,
      references: {
        owner_scope_id: "fp_1",
        fiscal_period_id: null,
        fiscal_document_id: null,
      },
    },
    occurredAt: new Date("2026-03-21T09:00:00.000Z"),
    createdAt: new Date("2026-03-21T09:00:00.000Z"),
    ...overrides,
  }
}

function createMemoryAuditStore() {
  const records = []
  const calls = {
    create: [],
    findMany: [],
  }

  return {
    records,
    calls,
    fiscalAuditLog: {
      async create(args) {
        calls.create.push(args)

        const record = createAuditRecord({
          id: `audit_${String(records.length + 1).padStart(3, "0")}`,
          ownerScopeId: args.data.ownerScopeId,
          fiscalPeriodId: args.data.fiscalPeriodId ?? null,
          fiscalDocumentId: args.data.fiscalDocumentId ?? null,
          event: args.data.event,
          schemaVersion: args.data.schemaVersion,
          payload: args.data.payload,
          occurredAt: args.data.occurredAt,
          createdAt: new Date("2026-03-21T10:00:00.000Z"),
        })

        records.push(record)
        return record
      },
      async findMany(args) {
        calls.findMany.push(args)

        const filtered = records.filter((record) => {
          if (record.ownerScopeId !== args.where.ownerScopeId) {
            return false
          }

          if (args.where.event && record.event !== args.where.event) {
            return false
          }

          if (args.where.fiscalPeriodId && record.fiscalPeriodId !== args.where.fiscalPeriodId) {
            return false
          }

          if (args.where.fiscalDocumentId && record.fiscalDocumentId !== args.where.fiscalDocumentId) {
            return false
          }

          return true
        })

        filtered.sort((left, right) => {
          const dateDiff = right.occurredAt.getTime() - left.occurredAt.getTime()

          if (dateDiff !== 0) {
            return dateDiff
          }

          return right.id.localeCompare(left.id)
        })

        return filtered.slice(0, args.take ?? filtered.length)
      },
    },
  }
}

test("appendFiscalAuditEvent persiste payload estable para una edicion fiscal", async () => {
  const store = createMemoryAuditStore()

  const event = await appendFiscalAuditEvent("fp_1", {
    event: FISCAL_AUDIT_EVENT_FISCAL_DOCUMENT_EDITED,
    fiscalPeriodId: "period_q1_2026",
    fiscalDocumentId: "fd_q1_001",
    reason: "Ajuste de contraparte",
    actor: {
      type: "user",
      id: "user_1",
    },
    occurredAt: "2026-03-21T09:15:00.000Z",
  }, store)

  assert.deepEqual(store.calls.create[0], {
    data: {
      ownerScopeId: "fp_1",
      fiscalPeriodId: "period_q1_2026",
      fiscalDocumentId: "fd_q1_001",
      event: FISCAL_AUDIT_EVENT_FISCAL_DOCUMENT_EDITED,
      schemaVersion: 1,
      payload: {
        schema_version: 1,
        event: FISCAL_AUDIT_EVENT_FISCAL_DOCUMENT_EDITED,
        actor: {
          type: "user",
          id: "user_1",
        },
        reason: "Ajuste de contraparte",
        details: null,
        references: {
          owner_scope_id: "fp_1",
          fiscal_period_id: "period_q1_2026",
          fiscal_document_id: "fd_q1_001",
        },
      },
      occurredAt: new Date("2026-03-21T09:15:00.000Z"),
    },
  })

  assert.deepEqual(event, {
    id: "audit_001",
    ownerScopeId: "fp_1",
    fiscalPeriodId: "period_q1_2026",
    fiscalDocumentId: "fd_q1_001",
    event: FISCAL_AUDIT_EVENT_FISCAL_DOCUMENT_EDITED,
    schemaVersion: 1,
      actor: {
        type: "user",
        id: "user_1",
      },
      reason: "Ajuste de contraparte",
      details: null,
      occurredAt: "2026-03-21T09:15:00.000Z",
      createdAt: "2026-03-21T10:00:00.000Z",
      payload: {
        schema_version: 1,
      event: FISCAL_AUDIT_EVENT_FISCAL_DOCUMENT_EDITED,
        actor: {
          type: "user",
          id: "user_1",
        },
        reason: "Ajuste de contraparte",
        details: null,
        references: {
          owner_scope_id: "fp_1",
          fiscal_period_id: "period_q1_2026",
          fiscal_document_id: "fd_q1_001",
      },
    },
  })
})

test("listFiscalAuditEvents devuelve cierre y reapertura en orden determinista con filtros simples", async () => {
  const store = createMemoryAuditStore()

  store.records.push(
    createAuditRecord({
      id: "audit_001",
      fiscalPeriodId: "period_q1_2026",
      event: FISCAL_AUDIT_EVENT_PERIOD_CLOSED,
      payload: {
        schema_version: 1,
        event: FISCAL_AUDIT_EVENT_PERIOD_CLOSED,
        actor: {
          type: "system",
          id: null,
        },
        reason: "Cierre trimestral",
        details: null,
        references: {
          owner_scope_id: "fp_1",
          fiscal_period_id: "period_q1_2026",
          fiscal_document_id: null,
        },
      },
      occurredAt: new Date("2026-03-31T23:00:00.000Z"),
      createdAt: new Date("2026-03-31T23:00:00.000Z"),
    }),
    createAuditRecord({
      id: "audit_002",
      fiscalPeriodId: "period_q1_2026",
      event: FISCAL_AUDIT_EVENT_PERIOD_REOPENED,
      payload: {
        schema_version: 1,
        event: FISCAL_AUDIT_EVENT_PERIOD_REOPENED,
        actor: {
          type: "user",
          id: "user_2",
        },
        reason: "Regularizacion detectada",
        details: null,
        references: {
          owner_scope_id: "fp_1",
          fiscal_period_id: "period_q1_2026",
          fiscal_document_id: null,
        },
      },
      occurredAt: new Date("2026-04-01T08:00:00.000Z"),
      createdAt: new Date("2026-04-01T08:00:00.000Z"),
    }),
    createAuditRecord({
      id: "audit_003",
      fiscalPeriodId: "period_q1_2026",
      event: FISCAL_AUDIT_EVENT_PERIOD_CLOSED,
      payload: {
        schema_version: 1,
        event: FISCAL_AUDIT_EVENT_PERIOD_CLOSED,
        actor: {
          type: "user",
          id: "user_2",
        },
        reason: "Cierre final",
        details: null,
        references: {
          owner_scope_id: "fp_1",
          fiscal_period_id: "period_q1_2026",
          fiscal_document_id: null,
        },
      },
      occurredAt: new Date("2026-04-01T08:00:00.000Z"),
      createdAt: new Date("2026-04-01T08:05:00.000Z"),
    })
  )

  const allEvents = await listFiscalAuditEvents("fp_1", {
    fiscalPeriodId: "period_q1_2026",
  }, store)

  const closedOnly = await listFiscalAuditEvents("fp_1", {
    fiscalPeriodId: "period_q1_2026",
    event: FISCAL_AUDIT_EVENT_PERIOD_CLOSED,
    limit: 1,
  }, store)

  assert.deepEqual(
    allEvents.map((event) => ({
      id: event.id,
      event: event.event,
      occurredAt: event.occurredAt,
    })),
    [
      {
        id: "audit_003",
        event: FISCAL_AUDIT_EVENT_PERIOD_CLOSED,
        occurredAt: "2026-04-01T08:00:00.000Z",
      },
      {
        id: "audit_002",
        event: FISCAL_AUDIT_EVENT_PERIOD_REOPENED,
        occurredAt: "2026-04-01T08:00:00.000Z",
      },
      {
        id: "audit_001",
        event: FISCAL_AUDIT_EVENT_PERIOD_CLOSED,
        occurredAt: "2026-03-31T23:00:00.000Z",
      },
    ]
  )
  assert.equal(closedOnly.length, 1)
  assert.equal(closedOnly[0]?.id, "audit_003")
  assert.deepEqual(store.calls.findMany[1], {
    where: {
      ownerScopeId: "fp_1",
      event: FISCAL_AUDIT_EVENT_PERIOD_CLOSED,
      fiscalPeriodId: "period_q1_2026",
    },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: 1,
  })
})

test("appendFiscalAuditEvent admite details para eventos de resolucion de contraparte", async () => {
  const store = createMemoryAuditStore()

  const event = await appendFiscalAuditEvent(
    "fp_1",
    {
      event: FISCAL_AUDIT_EVENT_COUNTERPARTY_AUTO_LINKED,
      fiscalDocumentId: "fd_q1_008",
      actor: {
        type: "system",
        id: null,
      },
      reason: "Auto-link conservador por NIF exacto",
      details: {
        rule_version: "counterparty-resolution/v1",
        materiality_bucket: "high",
        chosen_counterparty_id: "cp_123",
      },
    },
    store
  )

  assert.deepEqual(store.calls.create[0], {
    data: {
      ownerScopeId: "fp_1",
      fiscalPeriodId: null,
      fiscalDocumentId: "fd_q1_008",
      event: FISCAL_AUDIT_EVENT_COUNTERPARTY_AUTO_LINKED,
      schemaVersion: 1,
      payload: {
        schema_version: 1,
        event: FISCAL_AUDIT_EVENT_COUNTERPARTY_AUTO_LINKED,
        actor: {
          type: "system",
          id: null,
        },
        reason: "Auto-link conservador por NIF exacto",
        details: {
          rule_version: "counterparty-resolution/v1",
          materiality_bucket: "high",
          chosen_counterparty_id: "cp_123",
        },
        references: {
          owner_scope_id: "fp_1",
          fiscal_period_id: null,
          fiscal_document_id: "fd_q1_008",
        },
      },
      occurredAt: event.occurredAt ? new Date(event.occurredAt) : new Date(),
    },
  })

  assert.deepEqual(event.payload.details, {
    rule_version: "counterparty-resolution/v1",
    materiality_bucket: "high",
    chosen_counterparty_id: "cp_123",
  })
})

test("appendFiscalAuditEvent y listFiscalAuditEvents validan inputs basicos", async () => {
  const store = createMemoryAuditStore()

  await assert.rejects(
    appendFiscalAuditEvent("   ", {
      event: FISCAL_AUDIT_EVENT_PERIOD_CLOSED,
      actor: {
        type: "user",
        id: "user_1",
      },
    }, store),
    /ownerScopeId es obligatorio/
  )

  await assert.rejects(
    appendFiscalAuditEvent("fp_1", {
      event: "otro_evento",
      actor: {
        type: "user",
        id: "user_1",
      },
    }, store),
    /FiscalAuditLog V1 no admite event=otro_evento/
  )

  await assert.rejects(
    appendFiscalAuditEvent("fp_1", {
      event: FISCAL_AUDIT_EVENT_PERIOD_REOPENED,
      actor: {
        type: "   ",
      },
    }, store),
    /actor.type es obligatorio/
  )

  await assert.rejects(
    listFiscalAuditEvents("fp_1", {
      limit: 0,
    }, store),
    /limit debe ser un entero positivo/
  )
})
