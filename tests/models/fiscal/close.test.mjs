import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { FISCAL_AUDIT_EVENT_FISCAL_DOCUMENT_EDIT_BLOCKED } from "../../../models/fiscal/audit-log.ts"
import {
  assertFiscalDocumentMutationAllowed,
  closeFiscalPeriod,
  getFiscalDocumentMutationLock,
  isFiscalPeriodLocked,
  mapTransactionFiscalRecordForClose,
  reopenFiscalPeriod,
} from "../../../models/fiscal/close.ts"
import {
  FISCAL_PERIOD_STATUS_OPEN,
  buildFiscalPeriodKey,
  buildFiscalQuarterBounds,
} from "../../../models/fiscal/periods.ts"

function loadGoldenQuarter() {
  return JSON.parse(
    readFileSync(new URL("../../fixtures/fiscal/golden-quarter.json", import.meta.url), "utf8")
  )
}

function createProfile(overrides = {}) {
  return {
    id: "fp_demo",
    companyName: "LedgerFlow Demo SL",
    taxId: "B12345678",
    ...overrides,
  }
}

function createPeriodRecord(goldenQuarter, overrides = {}) {
  const periodKey = buildFiscalPeriodKey(goldenQuarter.fiscal_year, goldenQuarter.quarter)
  const bounds = buildFiscalQuarterBounds(goldenQuarter.fiscal_year, goldenQuarter.quarter)

  return {
    id: `period_${periodKey.toLowerCase()}`,
    ownerScopeId: "fp_demo",
    fiscalYear: goldenQuarter.fiscal_year,
    quarter: goldenQuarter.quarter,
    periodKey,
    startsOn: bounds.startsOn,
    endsOn: bounds.endsOn,
    status: FISCAL_PERIOD_STATUS_OPEN,
    countryCode: "ES",
    currencyCode: "EUR",
    createdAt: new Date("2026-03-21T09:00:00.000Z"),
    updatedAt: new Date("2026-03-21T09:00:00.000Z"),
    ...overrides,
  }
}

function createTransactionRecord(document, overrides = {}) {
  return {
    id: document.header.fiscal_document_id,
    ownerScopeId: "fp_demo",
    sourceTransactionId: document.header.source_transaction_id,
    documentKind: document.header.document_kind,
    direction: document.header.direction,
    invoiceNumber: document.header.invoice_number,
    invoiceSeries: document.header.invoice_series,
    issueDate: new Date(`${document.header.issue_date}T00:00:00.000Z`),
    operationDate: document.header.operation_date
      ? new Date(`${document.header.operation_date}T00:00:00.000Z`)
      : null,
    paymentDate: document.header.payment_date
      ? new Date(`${document.header.payment_date}T00:00:00.000Z`)
      : null,
    currencyCode: document.header.currency_code,
    counterpartyId: document.header.counterparty_id,
    counterpartyRole: document.header.counterparty_role,
    counterpartyName: document.header.counterparty_name,
    counterpartyTaxId: document.header.counterparty_tax_id,
    counterpartyCountryCode: document.header.counterparty_country_code,
    companyTaxId: document.header.company_tax_id,
    reviewStatus: document.header.review_status,
    reviewReasons: document.header.review_reasons,
    vatPeriodAssignment: document.header.vat_period_assignment,
    withholdingPeriodAssignment: document.header.withholding_period_assignment,
    observedAmountCents: document.header.observed_amount_cents,
    totalNetCents: document.header.total_net_cents,
    totalVatCents: document.header.total_vat_cents,
    totalWithholdingCents: document.header.total_withholding_cents,
    totalGrossCents: document.header.total_gross_cents,
    totalPayableCents: document.header.total_payable_cents,
    sourceConfidence: document.header.source_confidence,
    notes: document.header.notes,
    createdAt: new Date("2026-03-21T09:00:00.000Z"),
    updatedAt: new Date("2026-03-21T09:00:00.000Z"),
    lines: document.lines.map((line) => ({
      id: line.line_id,
      transactionFiscalId: document.header.fiscal_document_id,
      lineNumber: line.line_number,
      concept: line.concept,
      baseAmountCents: line.base_amount_cents,
      vatTreatment: line.vat_treatment,
      vatRateBps: line.vat_rate_bps,
      vatAmountCents: line.vat_amount_cents,
      withholdingApplicable: line.withholding_applicable,
      withholdingRegime: line.withholding_regime,
      withholdingBaseCents: line.withholding_base_cents,
      withholdingRateBps: line.withholding_rate_bps,
      withholdingAmountCents: line.withholding_amount_cents,
      deductibilityPercentBps: line.deductibility_percent_bps,
      deductibilityReason: line.deductibility_reason,
      expenseFamily: line.expense_family,
      isReadyForVatBooks: line.is_ready_for_vat_books,
      isReadyForWithholdingBooks: line.is_ready_for_withholding_books,
      createdAt: new Date("2026-03-21T09:00:00.000Z"),
      updatedAt: new Date("2026-03-21T09:00:00.000Z"),
    })),
    ...overrides,
  }
}

function cloneFiscalDocument(document, overrides = {}) {
  return {
    ...document,
    header: {
      ...document.header,
      ...(overrides.header ?? {}),
    },
    lines: (overrides.lines ?? document.lines).map((line) => ({ ...line })),
  }
}

function createMemoryCloseStore({ periodRecord, transactionRecords }) {
  const periods = new Map([[periodRecord.periodKey, { ...periodRecord }]])
  const snapshots = new Map()
  const auditEvents = []

  return {
    __auditEvents: auditEvents,
    fiscalPeriod: {
      async findUnique(args) {
        const key =
          args.where.ownerScopeId_periodKey?.periodKey ??
          buildFiscalPeriodKey(
            args.where.ownerScopeId_fiscalYear_quarter.fiscalYear,
            args.where.ownerScopeId_fiscalYear_quarter.quarter
          )

        return periods.get(key) ?? null
      },
      async upsert(args) {
        const existing = periods.get(args.where.ownerScopeId_periodKey.periodKey)
        const next = {
          id: existing?.id ?? `period_${args.create.periodKey.toLowerCase()}`,
          ownerScopeId: existing?.ownerScopeId ?? args.create.ownerScopeId,
          fiscalYear: args.update.fiscalYear,
          quarter: args.update.quarter,
          periodKey: args.update.periodKey,
          startsOn: args.update.startsOn,
          endsOn: args.update.endsOn,
          status: args.update.status,
          countryCode: args.update.countryCode,
          currencyCode: args.update.currencyCode,
          createdAt: existing?.createdAt ?? new Date("2026-03-21T09:00:00.000Z"),
          updatedAt: new Date("2026-03-31T23:00:00.000Z"),
        }

        periods.set(next.periodKey, next)
        return next
      },
    },
    transactionFiscal: {
      async findMany() {
        return transactionRecords.map((record) => ({
          ...record,
          lines: record.lines.map((line) => ({ ...line })),
        }))
      },
    },
    fiscalPeriodSnapshot: {
      async findUnique(args) {
        const key = `${args.where.ownerScopeId_fiscalPeriodId_snapshotKind.ownerScopeId}:${args.where.ownerScopeId_fiscalPeriodId_snapshotKind.fiscalPeriodId}:${args.where.ownerScopeId_fiscalPeriodId_snapshotKind.snapshotKind}`
        return snapshots.get(key) ?? null
      },
      async findFirst(args) {
        const values = [...snapshots.values()].filter((record) => {
          if (record.ownerScopeId !== args.where.ownerScopeId) {
            return false
          }

          if (record.fiscalPeriodId !== args.where.fiscalPeriodId) {
            return false
          }

          if (args.where.snapshotKind && record.snapshotKind !== args.where.snapshotKind) {
            return false
          }

          return true
        })

        values.sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
        return values[0] ?? null
      },
      async upsert(args) {
        const key = `${args.where.ownerScopeId_fiscalPeriodId_snapshotKind.ownerScopeId}:${args.where.ownerScopeId_fiscalPeriodId_snapshotKind.fiscalPeriodId}:${args.where.ownerScopeId_fiscalPeriodId_snapshotKind.snapshotKind}`
        const existing = snapshots.get(key)
        const next = {
          id: existing?.id ?? "snapshot_001",
          ownerScopeId: args.create.ownerScopeId,
          fiscalPeriodId: args.create.fiscalPeriodId,
          snapshotKind: args.create.snapshotKind,
          schemaVersion: args.update.schemaVersion,
          payloadHash: args.update.payloadHash,
          generatedAt: args.update.generatedAt,
          payload: args.update.payload,
          createdAt: existing?.createdAt ?? new Date("2026-03-31T22:59:00.000Z"),
          updatedAt: new Date("2026-03-31T23:00:00.000Z"),
        }

        snapshots.set(key, next)
        return next
      },
    },
    fiscalAuditLog: {
      async create(args) {
        const next = {
          id: `audit_${String(auditEvents.length + 1).padStart(3, "0")}`,
          ownerScopeId: args.data.ownerScopeId,
          fiscalPeriodId: args.data.fiscalPeriodId,
          fiscalDocumentId: args.data.fiscalDocumentId,
          event: args.data.event,
          schemaVersion: args.data.schemaVersion,
          payload: args.data.payload,
          occurredAt: args.data.occurredAt,
          createdAt: args.data.occurredAt,
        }

        auditEvents.push(next)
        return next
      },
    },
  }
}

test("closeFiscalPeriod bloquea el cierre si el trimestre tiene documentos inconsistentes", async () => {
  const goldenQuarter = loadGoldenQuarter()
  const inconsistentDocument = cloneFiscalDocument(goldenQuarter.documents[0].document, {
    header: {
      review_status: "needs_review",
      review_reasons: ["missing_counterparty_relation"],
    },
    lines: goldenQuarter.documents[0].document.lines.map((line) => ({
      ...line,
      is_ready_for_vat_books: false,
      is_ready_for_withholding_books: false,
    })),
  })
  const store = createMemoryCloseStore({
    periodRecord: createPeriodRecord(goldenQuarter.quarter),
    transactionRecords: [createTransactionRecord(inconsistentDocument)],
  })

  await assert.rejects(
    () =>
      closeFiscalPeriod(
        {
          ownerScopeId: "fp_demo",
          fiscalProfile: createProfile(),
          periodKey: "2026-Q1",
          occurredAt: "2026-03-31T23:00:00.000Z",
        },
        store
      ),
    /No se puede cerrar el periodo 2026-Q1/
  )
})

test("mapTransactionFiscalRecordForClose preserva payment_date del registro persistido", () => {
  const goldenQuarter = loadGoldenQuarter()
  const document = cloneFiscalDocument(goldenQuarter.documents[1].document, {
    header: {
      payment_date: "2026-04-20",
    },
  })

  const mapped = mapTransactionFiscalRecordForClose(createTransactionRecord(document))

  assert.equal(mapped.header.payment_date, "2026-04-20")
})

test("isFiscalPeriodLocked y getFiscalDocumentMutationLock solo bloquean cambios fiscales sensibles", async () => {
  const goldenQuarter = loadGoldenQuarter()
  const currentDocument = goldenQuarter.documents[0].document
  const store = createMemoryCloseStore({
    periodRecord: createPeriodRecord(goldenQuarter.quarter, {
      status: "closed",
    }),
    transactionRecords: [],
  })

  assert.equal(isFiscalPeriodLocked("open"), false)
  assert.equal(isFiscalPeriodLocked("closed"), true)
  assert.equal(isFiscalPeriodLocked("presented"), true)

  const cosmeticLock = await getFiscalDocumentMutationLock(
    {
      ownerScopeId: "fp_demo",
      currentDocument,
      nextDocument: cloneFiscalDocument(currentDocument, {
        header: {
          notes: "Comentario interno sin impacto fiscal",
        },
      }),
    },
    store
  )

  assert.equal(cosmeticLock.hasSensitiveChange, false)
  assert.equal(cosmeticLock.locked, false)
  assert.deepEqual(cosmeticLock.periods, [])

  const fiscalLock = await getFiscalDocumentMutationLock(
    {
      ownerScopeId: "fp_demo",
      currentDocument,
      nextDocument: cloneFiscalDocument(currentDocument, {
        header: {
          total_net_cents: currentDocument.header.total_net_cents + 100,
          total_gross_cents: currentDocument.header.total_gross_cents + 100,
          total_payable_cents: currentDocument.header.total_payable_cents + 100,
        },
      }),
    },
    store
  )

  assert.equal(fiscalLock.hasSensitiveChange, true)
  assert.equal(fiscalLock.locked, true)
  assert.deepEqual(fiscalLock.periods, [
    {
      id: "period_2026-q1",
      periodKey: "2026-Q1",
      status: "closed",
      locked: true,
    },
  ])
  assert.match(fiscalLock.message ?? "", /2026-Q1/)
})

test("assertFiscalDocumentMutationAllowed registra el intento bloqueado cuando el periodo ya esta cerrado", async () => {
  const goldenQuarter = loadGoldenQuarter()
  const currentDocument = goldenQuarter.documents[0].document
  const store = createMemoryCloseStore({
    periodRecord: createPeriodRecord(goldenQuarter.quarter, {
      status: "presented",
    }),
    transactionRecords: [],
  })

  await assert.rejects(
    () =>
      assertFiscalDocumentMutationAllowed(
        {
          ownerScopeId: "fp_demo",
          fiscalDocumentId: currentDocument.header.fiscal_document_id,
          currentDocument,
          nextDocument: cloneFiscalDocument(currentDocument, {
            header: {
              total_net_cents: currentDocument.header.total_net_cents + 50,
              total_gross_cents: currentDocument.header.total_gross_cents + 50,
              total_payable_cents: currentDocument.header.total_payable_cents + 50,
            },
          }),
          actor: {
            type: "user",
            id: "user_1",
          },
          occurredAt: "2026-04-02T09:00:00.000Z",
        },
        store
      ),
    /periodos cerrados o presentados/
  )

  assert.equal(store.__auditEvents.length, 1)
  assert.equal(store.__auditEvents[0].event, FISCAL_AUDIT_EVENT_FISCAL_DOCUMENT_EDIT_BLOCKED)
  assert.equal(store.__auditEvents[0].fiscalPeriodId, "period_2026-q1")
  assert.equal(store.__auditEvents[0].fiscalDocumentId, currentDocument.header.fiscal_document_id)
  assert.match(store.__auditEvents[0].payload.reason ?? "", /2026-Q1/)
})

test("closeFiscalPeriod genera snapshot reproducible y mueve el periodo a closed", async () => {
  const goldenQuarter = loadGoldenQuarter()
  const readyRecords = goldenQuarter.documents.map((entry) =>
    createTransactionRecord(entry.document, {
      reviewStatus: "ready",
      reviewReasons: [],
    })
  )
  const store = createMemoryCloseStore({
    periodRecord: createPeriodRecord(goldenQuarter.quarter),
    transactionRecords: readyRecords,
  })

  const result = await closeFiscalPeriod(
    {
      ownerScopeId: "fp_demo",
      fiscalProfile: createProfile(),
      periodKey: "2026-Q1",
      occurredAt: "2026-03-31T23:00:00.000Z",
    },
    store
  )

  assert.equal(result.period.status, "closed")
  assert.equal(result.snapshot.payload.period.status, "closed")
  assert.deepEqual(result.snapshot.payload.summary.review_status_counts, {
    ready: 7,
    needs_review: 0,
    blocked: 0,
    pending: 0,
  })
  assert.deepEqual(result.snapshot.payload.summary.model_303, goldenQuarter.expected_quarter.model_303)
  assert.deepEqual(result.snapshot.payload.summary.model_115, goldenQuarter.expected_quarter.model_115)
  assert.equal(result.snapshot.payload.company.company_name, "LedgerFlow Demo SL")
  assert.equal(result.snapshot.payload.company.company_tax_id, "B12345678")
  assert.equal(store.__auditEvents.length, 1)
  assert.equal(store.__auditEvents[0].event, "period_closed")
  assert.equal(store.__auditEvents[0].payload.reason, null)
})

test("reopenFiscalPeriod exige motivo y devuelve un periodo closed a in_review", async () => {
  const goldenQuarter = loadGoldenQuarter()
  const store = createMemoryCloseStore({
    periodRecord: createPeriodRecord(goldenQuarter.quarter, {
      status: "closed",
    }),
    transactionRecords: [],
  })

  await assert.rejects(
    () =>
      reopenFiscalPeriod(
        {
          ownerScopeId: "fp_demo",
          fiscalProfile: createProfile(),
          periodKey: "2026-Q1",
          reason: "   ",
          occurredAt: "2026-04-01T08:00:00.000Z",
        },
        store
      ),
    /reason es obligatorio/
  )

  const result = await reopenFiscalPeriod(
    {
      ownerScopeId: "fp_demo",
      fiscalProfile: createProfile(),
      periodKey: "2026-Q1",
      reason: "Regularizacion detectada",
      occurredAt: "2026-04-01T08:00:00.000Z",
    },
    store
  )

  assert.equal(result.previousStatus, "closed")
  assert.equal(result.period.status, "in_review")
  assert.equal(result.reason, "Regularizacion detectada")
  assert.equal(store.__auditEvents.length, 1)
  assert.equal(store.__auditEvents[0].event, "period_reopened")
  assert.equal(store.__auditEvents[0].payload.reason, "Regularizacion detectada")
})

test("reopenFiscalPeriod valida que ownerScopeId y perfil fiscal coincidan y reabre presented a in_review", async () => {
  const goldenQuarter = loadGoldenQuarter()
  const store = createMemoryCloseStore({
    periodRecord: createPeriodRecord(goldenQuarter.quarter, {
      status: "presented",
    }),
    transactionRecords: [],
  })

  await assert.rejects(
    () =>
      reopenFiscalPeriod(
        {
          ownerScopeId: "fp_demo",
          fiscalProfile: createProfile({ id: "fp_other" }),
          periodKey: "2026-Q1",
          reason: "Correccion censal",
        },
        store
      ),
    /debe coincidir con el ownerScopeId/
  )

  const result = await reopenFiscalPeriod(
    {
      ownerScopeId: "fp_demo",
      fiscalProfile: createProfile(),
      periodKey: "2026-Q1",
      reason: "Correccion censal",
      occurredAt: "2026-04-01T09:00:00.000Z",
    },
    store
  )

  assert.equal(result.previousStatus, "presented")
  assert.equal(result.period.status, "in_review")
})
