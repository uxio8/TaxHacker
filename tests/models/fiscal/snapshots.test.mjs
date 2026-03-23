import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  FISCAL_PERIOD_SNAPSHOT_KIND_CLOSE,
  FISCAL_PERIOD_SNAPSHOT_SCHEMA_VERSION,
  getLatestFiscalPeriodSnapshot,
  replaceFiscalPeriodSnapshot,
} from "../../../models/fiscal/snapshots.ts"

function loadGoldenQuarter() {
  return JSON.parse(
    readFileSync(new URL("../../fixtures/fiscal/golden-quarter.json", import.meta.url), "utf8")
  )
}

function createFiscalPeriod(overrides = {}) {
  return {
    id: "period_q1_2026",
    ownerScopeId: "fp_1",
    fiscalYear: 2026,
    quarter: 1,
    periodKey: "2026-Q1",
    startsOn: "2026-01-01",
    endsOn: "2026-03-31",
    status: "closed",
    countryCode: "ES",
    currencyCode: "EUR",
    createdAt: "2026-03-21T09:00:00.000Z",
    updatedAt: "2026-03-21T09:00:00.000Z",
    ...overrides,
  }
}

function createSnapshotInput(overrides = {}) {
  const goldenQuarter = loadGoldenQuarter()

  return {
    period: createFiscalPeriod(),
    company: {
      companyName: goldenQuarter.company.company_name,
      companyTaxId: goldenQuarter.company.company_tax_id,
    },
    summary: {
      review_status_counts: { ...goldenQuarter.expected_quarter.review_status_counts },
      model_303: JSON.parse(JSON.stringify(goldenQuarter.expected_quarter.model_303)),
      model_115: JSON.parse(JSON.stringify(goldenQuarter.expected_quarter.model_115)),
    },
    vatBooks: JSON.parse(JSON.stringify(goldenQuarter.expected_quarter.vat_books)),
    generatedAt: "2026-03-31T23:59:59.000Z",
    ...overrides,
  }
}

function createMemorySnapshotStore() {
  const records = new Map()
  const calls = {
    findUnique: 0,
    findFirst: 0,
    upsert: 0,
  }

  return {
    records,
    calls,
    fiscalPeriodSnapshot: {
      async findUnique(args) {
        calls.findUnique += 1
        const lookup = args.where.ownerScopeId_fiscalPeriodId_snapshotKind

        return (
          records.get(`${lookup.ownerScopeId}:${lookup.fiscalPeriodId}:${lookup.snapshotKind}`) ?? null
        )
      },
      async findFirst(args) {
        calls.findFirst += 1
        const matches = [...records.values()].filter((record) => {
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

        matches.sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())

        return matches[0] ?? null
      },
      async upsert(args) {
        calls.upsert += 1
        const lookup = args.where.ownerScopeId_fiscalPeriodId_snapshotKind
        const recordKey = `${lookup.ownerScopeId}:${lookup.fiscalPeriodId}:${lookup.snapshotKind}`
        const existing = records.get(recordKey)

        if (existing) {
          const updatedRecord = {
            ...existing,
            ...args.update,
            updatedAt: new Date("2026-04-01T00:00:00.000Z"),
          }

          records.set(recordKey, updatedRecord)
          return updatedRecord
        }

        const createdRecord = {
          id: `snapshot_${records.size + 1}`,
          ownerScopeId: args.create.ownerScopeId,
          fiscalPeriodId: args.create.fiscalPeriodId,
          snapshotKind: args.create.snapshotKind,
          schemaVersion: args.create.schemaVersion,
          payloadHash: args.create.payloadHash,
          generatedAt: args.create.generatedAt,
          payload: args.create.payload,
          createdAt: new Date("2026-03-31T23:59:59.000Z"),
          updatedAt: new Date("2026-03-31T23:59:59.000Z"),
        }

        records.set(recordKey, createdRecord)
        return createdRecord
      },
    },
  }
}

test("replaceFiscalPeriodSnapshot crea un snapshot close reproducible y getLatest devuelve el ultimo", async () => {
  const store = createMemorySnapshotStore()
  const input = createSnapshotInput()

  input.summary.model_303.documents_included.reverse()
  input.summary.model_115.landlord_counterparty_ids.reverse()
  input.vatBooks.received.reverse()
  input.vatBooks.issued.reverse()

  const snapshot = await replaceFiscalPeriodSnapshot("fp_1", input, store)
  const latest = await getLatestFiscalPeriodSnapshot("fp_1", input.period.id, {
    snapshotKind: FISCAL_PERIOD_SNAPSHOT_KIND_CLOSE,
  }, store)

  assert.equal(snapshot.snapshotKind, FISCAL_PERIOD_SNAPSHOT_KIND_CLOSE)
  assert.equal(snapshot.schemaVersion, FISCAL_PERIOD_SNAPSHOT_SCHEMA_VERSION)
  assert.match(snapshot.payloadHash, /^[a-f0-9]{64}$/)
  assert.equal(snapshot.generatedAt, "2026-03-31T23:59:59.000Z")
  assert.deepEqual(snapshot, latest)
  assert.deepEqual(snapshot.payload, {
    schema_version: 1,
    company: {
      company_name: "LedgerFlow Demo SL",
      company_tax_id: "B11223344",
      country_code: "ES",
      currency_code: "EUR",
    },
    period: {
      fiscal_period_id: "period_q1_2026",
      fiscal_year: 2026,
      quarter: 1,
      period_key: "2026-Q1",
      starts_on: "2026-01-01",
      ends_on: "2026-03-31",
      status: "closed",
      country_code: "ES",
      currency_code: "EUR",
    },
    summary: {
      review_status_counts: {
        ready: 7,
        needs_review: 0,
        blocked: 1,
        pending: 0,
      },
      model_303: loadGoldenQuarter().expected_quarter.model_303,
      model_115: loadGoldenQuarter().expected_quarter.model_115,
    },
    vat_books: loadGoldenQuarter().expected_quarter.vat_books,
  })
})

test("replaceFiscalPeriodSnapshot es idempotente cuando la entrada normalizada no cambia", async () => {
  const store = createMemorySnapshotStore()
  const firstInput = createSnapshotInput()
  const secondInput = createSnapshotInput()

  secondInput.summary.model_303.documents_included = [
    ...secondInput.summary.model_303.documents_included,
  ].reverse()
  secondInput.vatBooks.received = [...secondInput.vatBooks.received].reverse()

  const first = await replaceFiscalPeriodSnapshot("fp_1", firstInput, store)
  const second = await replaceFiscalPeriodSnapshot("fp_1", secondInput, store)

  assert.equal(first.id, second.id)
  assert.equal(first.updatedAt, second.updatedAt)
  assert.equal(store.calls.upsert, 1)
  assert.equal(store.records.size, 1)
})

test("replaceFiscalPeriodSnapshot reemplaza el payload cuando cambian los valores del periodo", async () => {
  const store = createMemorySnapshotStore()
  const firstInput = createSnapshotInput()
  const secondInput = createSnapshotInput({
    summary: {
      ...createSnapshotInput().summary,
      model_303: {
        ...createSnapshotInput().summary.model_303,
        result_vat_payable_cents: 9100,
      },
    },
    generatedAt: "2026-04-01T00:00:00.000Z",
  })

  const first = await replaceFiscalPeriodSnapshot("fp_1", firstInput, store)
  const second = await replaceFiscalPeriodSnapshot("fp_1", secondInput, store)

  assert.equal(first.id, second.id)
  assert.notEqual(first.payloadHash, second.payloadHash)
  assert.equal(second.generatedAt, "2026-04-01T00:00:00.000Z")
  assert.equal(second.payload.summary.model_303.result_vat_payable_cents, 9100)
  assert.equal(store.calls.upsert, 2)
})

test("replaceFiscalPeriodSnapshot rechaza periodos de otro ownerScopeId", async () => {
  const store = createMemorySnapshotStore()
  const input = createSnapshotInput({
    period: createFiscalPeriod({
      ownerScopeId: "fp_2",
    }),
  })

  await assert.rejects(
    replaceFiscalPeriodSnapshot("fp_1", input, store),
    /ownerScopeId del periodo debe coincidir/
  )
  assert.equal(store.calls.upsert, 0)
})

test("getLatestFiscalPeriodSnapshot devuelve null cuando no existe snapshot", async () => {
  const store = createMemorySnapshotStore()

  const snapshot = await getLatestFiscalPeriodSnapshot("fp_1", "period_q1_2026", undefined, store)

  assert.equal(snapshot, null)
})
