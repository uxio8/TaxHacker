import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  FISCAL_PERIOD_STATUS_IN_REVIEW,
  FISCAL_PERIOD_STATUS_OPEN,
  buildFiscalPeriodAssignment,
  ensureFiscalPeriod,
  ensureFiscalYearPeriods,
  getFiscalPeriodByKey,
  syncDefaultSpanishFiscalPeriodsV1,
} from "../../../models/fiscal/periods.ts"

function loadGoldenQuarter() {
  return JSON.parse(
    readFileSync(new URL("../../fixtures/fiscal/golden-quarter.json", import.meta.url), "utf8")
  )
}

function createFiscalPeriodRecord(overrides = {}) {
  return {
    id: "period_q1_2026",
    ownerScopeId: "fp_1",
    fiscalYear: 2026,
    quarter: 1,
    periodKey: "2026-Q1",
    startsOn: new Date("2026-01-01T00:00:00.000Z"),
    endsOn: new Date("2026-03-31T00:00:00.000Z"),
    status: FISCAL_PERIOD_STATUS_OPEN,
    countryCode: "ES",
    currencyCode: "EUR",
    createdAt: new Date("2026-03-21T09:00:00.000Z"),
    updatedAt: new Date("2026-03-21T09:00:00.000Z"),
    ...overrides,
  }
}

function createMemoryFiscalPeriodStore() {
  const records = new Map()
  const calls = []

  return {
    calls,
    records,
    fiscalPeriod: {
      async findUnique(args) {
        if ("ownerScopeId_periodKey" in args.where) {
          const lookup = args.where.ownerScopeId_periodKey
          return records.get(`${lookup.ownerScopeId}:${lookup.periodKey}`) ?? null
        }

        if ("ownerScopeId_fiscalYear_quarter" in args.where) {
          const lookup = args.where.ownerScopeId_fiscalYear_quarter
          return records.get(`${lookup.ownerScopeId}:${lookup.fiscalYear}-Q${lookup.quarter}`) ?? null
        }

        return null
      },
      async upsert(args) {
        calls.push(args)

        const lookup = args.where.ownerScopeId_periodKey
        const recordKey = `${lookup.ownerScopeId}:${lookup.periodKey}`
        const existing = records.get(recordKey)
        const nextRecord = existing
          ? {
              ...existing,
              ...args.update,
              updatedAt: existing.updatedAt,
            }
          : createFiscalPeriodRecord({
              id: `period_${lookup.periodKey.toLowerCase()}`,
              ownerScopeId: lookup.ownerScopeId,
              fiscalYear: args.create.fiscalYear,
              quarter: args.create.quarter,
              periodKey: args.create.periodKey,
              startsOn: args.create.startsOn,
              endsOn: args.create.endsOn,
              status: args.create.status,
              countryCode: args.create.countryCode,
              currencyCode: args.create.currencyCode,
            })

        records.set(recordKey, nextRecord)
        return nextRecord
      },
    },
  }
}

test("ensureFiscalPeriod crea de forma idempotente un trimestre natural ES/EUR con estado open por defecto", async () => {
  const store = createMemoryFiscalPeriodStore()

  const first = await ensureFiscalPeriod("fp_1", {
    fiscalYear: 2026,
    quarter: 1,
  }, store)

  const second = await ensureFiscalPeriod("fp_1", {
    fiscalYear: 2026,
    quarter: 1,
  }, store)

  assert.deepEqual(
    {
      fiscalYear: first.fiscalYear,
      quarter: first.quarter,
      periodKey: first.periodKey,
      startsOn: first.startsOn,
      endsOn: first.endsOn,
      status: first.status,
      countryCode: first.countryCode,
      currencyCode: first.currencyCode,
    },
    {
      fiscalYear: 2026,
      quarter: 1,
      periodKey: "2026-Q1",
      startsOn: "2026-01-01",
      endsOn: "2026-03-31",
      status: FISCAL_PERIOD_STATUS_OPEN,
      countryCode: "ES",
      currencyCode: "EUR",
    }
  )
  assert.equal(second.id, first.id)
  assert.equal(store.records.size, 1)
})

test("ensureFiscalPeriod permite fijar un estado explicito para el periodo", async () => {
  const store = createMemoryFiscalPeriodStore()

  const period = await ensureFiscalPeriod("fp_1", {
    fiscalYear: 2026,
    quarter: 2,
    status: FISCAL_PERIOD_STATUS_IN_REVIEW,
  }, store)

  assert.equal(period.status, FISCAL_PERIOD_STATUS_IN_REVIEW)
  assert.equal(period.periodKey, "2026-Q2")
})

test("ensureFiscalPeriod preserva el estado existente cuando la llamada no trae status", async () => {
  const store = createMemoryFiscalPeriodStore()

  store.records.set(
    "fp_1:2026-Q2",
    createFiscalPeriodRecord({
      id: "period_q2_2026",
      quarter: 2,
      periodKey: "2026-Q2",
      startsOn: new Date("2026-04-01T00:00:00.000Z"),
      endsOn: new Date("2026-06-30T00:00:00.000Z"),
      status: FISCAL_PERIOD_STATUS_IN_REVIEW,
    })
  )

  const period = await ensureFiscalPeriod("fp_1", {
    fiscalYear: 2026,
    quarter: 2,
  }, store)

  assert.equal(period.status, FISCAL_PERIOD_STATUS_IN_REVIEW)
  assert.equal(store.calls[0]?.update.status, FISCAL_PERIOD_STATUS_IN_REVIEW)
})

test("getFiscalPeriodByKey busca por ownerScopeId y period_key", async () => {
  const store = {
    fiscalPeriod: {
      async findUnique(args) {
        assert.deepEqual(args, {
          where: {
            ownerScopeId_periodKey: {
              ownerScopeId: "fp_1",
              periodKey: "2026-Q1",
            },
          },
        })

        return createFiscalPeriodRecord()
      },
      async upsert() {
        throw new Error("no deberia llamarse")
      },
    },
  }

  const period = await getFiscalPeriodByKey("fp_1", "2026-Q1", store)

  assert.equal(period?.id, "period_q1_2026")
  assert.equal(period?.startsOn, "2026-01-01")
  assert.equal(period?.endsOn, "2026-03-31")
})

test("buildFiscalPeriodAssignment conserva el contrato FiscalPeriodAssignment usado por TransactionFiscal", () => {
  const goldenQuarter = loadGoldenQuarter().quarter

  const assignment = buildFiscalPeriodAssignment(createFiscalPeriodRecord(), {
    basis: "issue_date",
    assignedAt: "2026-03-21T09:00:00Z",
  })

  assert.deepEqual(assignment, {
    fiscal_year: goldenQuarter.fiscal_year,
    quarter: goldenQuarter.quarter,
    period_key: goldenQuarter.period_key,
    basis: "issue_date",
    assigned_at: "2026-03-21T09:00:00Z",
  })
})

test("ensureFiscalYearPeriods genera los cuatro trimestres naturales del ejercicio", async () => {
  const goldenQuarter = loadGoldenQuarter().quarter
  const store = createMemoryFiscalPeriodStore()

  store.records.set(
    "fp_1:2026-Q1",
    createFiscalPeriodRecord({
      status: FISCAL_PERIOD_STATUS_IN_REVIEW,
    })
  )

  const periods = await ensureFiscalYearPeriods("fp_1", 2026, store)

  assert.deepEqual(
    periods.map((period) => ({
      periodKey: period.periodKey,
      startsOn: period.startsOn,
      endsOn: period.endsOn,
      status: period.status,
    })),
    [
      {
        periodKey: goldenQuarter.period_key,
        startsOn: goldenQuarter.from,
        endsOn: goldenQuarter.to,
        status: FISCAL_PERIOD_STATUS_IN_REVIEW,
      },
      {
        periodKey: "2026-Q2",
        startsOn: "2026-04-01",
        endsOn: "2026-06-30",
        status: FISCAL_PERIOD_STATUS_OPEN,
      },
      {
        periodKey: "2026-Q3",
        startsOn: "2026-07-01",
        endsOn: "2026-09-30",
        status: FISCAL_PERIOD_STATUS_OPEN,
      },
      {
        periodKey: "2026-Q4",
        startsOn: "2026-10-01",
        endsOn: "2026-12-31",
        status: FISCAL_PERIOD_STATUS_OPEN,
      },
    ]
  )
  assert.equal(store.records.size, 4)
})

test("syncDefaultSpanishFiscalPeriodsV1 genera el ejercicio actual y el anterior", async () => {
  const store = createMemoryFiscalPeriodStore()

  const periods = await syncDefaultSpanishFiscalPeriodsV1(
    "fp_1",
    {
      referenceDate: "2026-03-22T09:00:00.000Z",
    },
    store
  )

  assert.deepEqual(
    periods.map((period) => period.periodKey),
    [
      "2025-Q1",
      "2025-Q2",
      "2025-Q3",
      "2025-Q4",
      "2026-Q1",
      "2026-Q2",
      "2026-Q3",
      "2026-Q4",
    ]
  )
  assert.equal(store.records.size, 8)
})

test("ensureFiscalPeriod rechaza quarters fuera de 1..4", async () => {
  await assert.rejects(
    ensureFiscalPeriod("fp_1", {
      fiscalYear: 2026,
      quarter: 5,
    }),
    /quarter/
  )
})
