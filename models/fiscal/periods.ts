import type { FiscalPeriodAssignment } from "./review-status.ts"

export const FISCAL_PERIOD_COUNTRY_CODE = "ES" as const
export const FISCAL_PERIOD_CURRENCY_CODE = "EUR" as const

export const FISCAL_PERIOD_STATUS_OPEN = "open" as const
export const FISCAL_PERIOD_STATUS_IN_REVIEW = "in_review" as const
export const FISCAL_PERIOD_STATUS_READY = "ready" as const
export const FISCAL_PERIOD_STATUS_PRESENTED = "presented" as const
export const FISCAL_PERIOD_STATUS_CLOSED = "closed" as const

const FISCAL_PERIOD_STATUSES = [
  FISCAL_PERIOD_STATUS_OPEN,
  FISCAL_PERIOD_STATUS_IN_REVIEW,
  FISCAL_PERIOD_STATUS_READY,
  FISCAL_PERIOD_STATUS_PRESENTED,
  FISCAL_PERIOD_STATUS_CLOSED,
] as const

const PERIOD_KEY_PATTERN = /^(\d{4})-Q([1-4])$/

export type FiscalPeriodStatus = (typeof FISCAL_PERIOD_STATUSES)[number]

export type FiscalPeriodInput = {
  fiscalYear: number
  quarter: number
  status?: string | null
  countryCode?: string | null
  currencyCode?: string | null
}

export type FiscalPeriod = {
  id: string
  ownerScopeId: string
  fiscalYear: number
  quarter: number
  periodKey: string
  startsOn: string
  endsOn: string
  status: FiscalPeriodStatus
  countryCode: string
  currencyCode: string
  createdAt: string
  updatedAt: string
}

export type DefaultSpanishFiscalPeriodsV1Options = {
  referenceDate?: string | Date | null
}

type FiscalPeriodRecord = {
  id: string
  ownerScopeId: string
  fiscalYear: number
  quarter: number
  periodKey: string
  startsOn: Date
  endsOn: Date
  status: string
  countryCode: string
  currencyCode: string
  createdAt: Date
  updatedAt: Date
}

type FiscalPeriodStore = {
  fiscalPeriod: {
    findUnique(args: {
      where: {
        ownerScopeId_periodKey?: {
          ownerScopeId: string
          periodKey: string
        }
        ownerScopeId_fiscalYear_quarter?: {
          ownerScopeId: string
          fiscalYear: number
          quarter: number
        }
      }
    }): Promise<FiscalPeriodRecord | null>
    upsert(args: {
      where: {
        ownerScopeId_periodKey: {
          ownerScopeId: string
          periodKey: string
        }
      }
      update: {
        fiscalYear: number
        quarter: number
        periodKey: string
        startsOn: Date
        endsOn: Date
        status: FiscalPeriodStatus
        countryCode: string
        currencyCode: string
      }
      create: {
        ownerScopeId: string
        fiscalYear: number
        quarter: number
        periodKey: string
        startsOn: Date
        endsOn: Date
        status: FiscalPeriodStatus
        countryCode: string
        currencyCode: string
      }
    }): Promise<FiscalPeriodRecord>
  }
}

type FiscalPeriodDbClient = Pick<FiscalPeriodStore, "fiscalPeriod">

function trimToNull(value?: string | null): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function serializeDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function serializeDateTime(value: Date): string {
  return value.toISOString()
}

function normalizeOwnerScopeId(ownerScopeId: string): string {
  const normalized = trimToNull(ownerScopeId)

  if (!normalized) {
    throw new Error("ownerScopeId es obligatorio para operar con periodos fiscales")
  }

  return normalized
}

function normalizeFiscalYear(fiscalYear: number): number {
  if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 9999) {
    throw new Error("fiscalYear debe ser un entero de cuatro cifras")
  }

  return fiscalYear
}

function normalizeQuarter(quarter: number): number {
  if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
    throw new Error("quarter debe estar entre 1 y 4")
  }

  return quarter
}

function normalizeReferenceDate(referenceDate?: string | Date | null): Date {
  if (!referenceDate) {
    return new Date()
  }

  const normalized = referenceDate instanceof Date ? referenceDate : new Date(referenceDate)

  if (Number.isNaN(normalized.getTime())) {
    throw new Error("referenceDate no es una fecha valida")
  }

  return normalized
}

function normalizeStatus(status?: string | null): FiscalPeriodStatus {
  const normalized = trimToNull(status) ?? FISCAL_PERIOD_STATUS_OPEN

  if (!FISCAL_PERIOD_STATUSES.includes(normalized as FiscalPeriodStatus)) {
    throw new Error(`FiscalPeriod V1 no admite status=${normalized}`)
  }

  return normalized as FiscalPeriodStatus
}

function resolveStatusForWrite(
  inputStatus: string | null | undefined,
  existingStatus?: string | null
): FiscalPeriodStatus {
  const normalizedInputStatus = trimToNull(inputStatus)

  if (normalizedInputStatus) {
    return normalizeStatus(normalizedInputStatus)
  }

  const normalizedExistingStatus = trimToNull(existingStatus)

  if (normalizedExistingStatus) {
    return normalizeStatus(normalizedExistingStatus)
  }

  return FISCAL_PERIOD_STATUS_OPEN
}

function assertV1FiscalPeriodInput(input: FiscalPeriodInput) {
  if ((input.countryCode ?? FISCAL_PERIOD_COUNTRY_CODE) !== FISCAL_PERIOD_COUNTRY_CODE) {
    throw new Error(`FiscalPeriod V1 solo admite countryCode=${FISCAL_PERIOD_COUNTRY_CODE}`)
  }

  if ((input.currencyCode ?? FISCAL_PERIOD_CURRENCY_CODE) !== FISCAL_PERIOD_CURRENCY_CODE) {
    throw new Error(`FiscalPeriod V1 solo admite currencyCode=${FISCAL_PERIOD_CURRENCY_CODE}`)
  }
}

export function buildFiscalPeriodKey(fiscalYear: number, quarter: number): string {
  return `${normalizeFiscalYear(fiscalYear)}-Q${normalizeQuarter(quarter)}`
}

export function buildFiscalQuarterBounds(fiscalYear: number, quarter: number) {
  const normalizedFiscalYear = normalizeFiscalYear(fiscalYear)
  const normalizedQuarter = normalizeQuarter(quarter)
  const startMonth = (normalizedQuarter - 1) * 3

  return {
    startsOn: new Date(Date.UTC(normalizedFiscalYear, startMonth, 1)),
    endsOn: new Date(Date.UTC(normalizedFiscalYear, startMonth + 3, 0)),
  }
}

function buildFiscalPeriodWriteInput(
  input: FiscalPeriodInput,
  existingStatus?: string | null
) {
  assertV1FiscalPeriodInput(input)

  const fiscalYear = normalizeFiscalYear(input.fiscalYear)
  const quarter = normalizeQuarter(input.quarter)
  const periodKey = buildFiscalPeriodKey(fiscalYear, quarter)
  const { startsOn, endsOn } = buildFiscalQuarterBounds(fiscalYear, quarter)

  return {
    fiscalYear,
    quarter,
    periodKey,
    startsOn,
    endsOn,
    status: resolveStatusForWrite(input.status, existingStatus),
    countryCode: FISCAL_PERIOD_COUNTRY_CODE,
    currencyCode: FISCAL_PERIOD_CURRENCY_CODE,
  }
}

function parsePeriodKey(periodKey: string) {
  const normalized = trimToNull(periodKey)

  if (!normalized) {
    throw new Error("periodKey es obligatorio")
  }

  const match = PERIOD_KEY_PATTERN.exec(normalized)

  if (!match) {
    throw new Error("periodKey debe seguir el formato YYYY-QN")
  }

  return {
    periodKey: normalized,
    fiscalYear: Number.parseInt(match[1] as string, 10),
    quarter: Number.parseInt(match[2] as string, 10),
  }
}

function mapRecordToFiscalPeriod(record: FiscalPeriodRecord): FiscalPeriod {
  return {
    id: record.id,
    ownerScopeId: record.ownerScopeId,
    fiscalYear: record.fiscalYear,
    quarter: record.quarter,
    periodKey: record.periodKey,
    startsOn: serializeDateOnly(record.startsOn),
    endsOn: serializeDateOnly(record.endsOn),
    status: normalizeStatus(record.status),
    countryCode: record.countryCode,
    currencyCode: record.currencyCode,
    createdAt: serializeDateTime(record.createdAt),
    updatedAt: serializeDateTime(record.updatedAt),
  }
}

function createFiscalPeriodStore(db: FiscalPeriodDbClient): FiscalPeriodStore {
  return {
    fiscalPeriod: {
      findUnique(args) {
        return db.fiscalPeriod.findUnique(args)
      },
      upsert(args) {
        return db.fiscalPeriod.upsert(args)
      },
    },
  }
}

async function resolveStore(store?: FiscalPeriodStore): Promise<FiscalPeriodStore> {
  if (store) {
    return store
  }

  const { prisma } = await import("../../lib/db.ts")
  return createFiscalPeriodStore(prisma as unknown as FiscalPeriodDbClient)
}

export function buildFiscalPeriodAssignment(
  period: Pick<FiscalPeriod, "fiscalYear" | "quarter" | "periodKey">,
  options: {
    basis: string
    assignedAt: string | Date
  }
): FiscalPeriodAssignment {
  const basis = trimToNull(options.basis)

  if (!basis) {
    throw new Error("basis es obligatorio para construir la asignacion fiscal")
  }

  return {
    fiscal_year: normalizeFiscalYear(period.fiscalYear),
    quarter: normalizeQuarter(period.quarter),
    period_key: buildFiscalPeriodKey(period.fiscalYear, period.quarter),
    basis,
    assigned_at:
      options.assignedAt instanceof Date ? options.assignedAt.toISOString() : options.assignedAt,
  }
}

export async function ensureFiscalPeriod(
  ownerScopeId: string,
  input: FiscalPeriodInput,
  store?: FiscalPeriodStore
): Promise<FiscalPeriod> {
  const normalizedOwnerScopeId = normalizeOwnerScopeId(ownerScopeId)
  const periodKey = buildFiscalPeriodKey(input.fiscalYear, input.quarter)
  const db = await resolveStore(store)
  const existing = await db.fiscalPeriod.findUnique({
    where: {
      ownerScopeId_periodKey: {
        ownerScopeId: normalizedOwnerScopeId,
        periodKey,
      },
    },
  })
  const data = buildFiscalPeriodWriteInput(input, existing?.status)

  const record = await db.fiscalPeriod.upsert({
    where: {
      ownerScopeId_periodKey: {
        ownerScopeId: normalizedOwnerScopeId,
        periodKey: data.periodKey,
      },
    },
    update: data,
    create: {
      ownerScopeId: normalizedOwnerScopeId,
      ...data,
    },
  })

  return mapRecordToFiscalPeriod(record)
}

export async function getFiscalPeriodByKey(
  ownerScopeId: string,
  periodKey: string,
  store?: FiscalPeriodStore
): Promise<FiscalPeriod | null> {
  const normalizedOwnerScopeId = normalizeOwnerScopeId(ownerScopeId)
  const lookup = parsePeriodKey(periodKey)
  const db = await resolveStore(store)

  const record = await db.fiscalPeriod.findUnique({
    where: {
      ownerScopeId_periodKey: {
        ownerScopeId: normalizedOwnerScopeId,
        periodKey: lookup.periodKey,
      },
    },
  })

  return record ? mapRecordToFiscalPeriod(record) : null
}

export async function ensureFiscalYearPeriods(
  ownerScopeId: string,
  fiscalYear: number,
  store?: FiscalPeriodStore
): Promise<FiscalPeriod[]> {
  const normalizedOwnerScopeId = normalizeOwnerScopeId(ownerScopeId)
  const normalizedFiscalYear = normalizeFiscalYear(fiscalYear)
  const db = await resolveStore(store)

  return Promise.all(
    [1, 2, 3, 4].map((quarter) =>
      ensureFiscalPeriod(
        normalizedOwnerScopeId,
        {
          fiscalYear: normalizedFiscalYear,
          quarter,
        },
        db
      )
    )
  )
}

export async function syncDefaultSpanishFiscalPeriodsV1(
  ownerScopeId: string,
  options?: DefaultSpanishFiscalPeriodsV1Options,
  store?: FiscalPeriodStore
): Promise<FiscalPeriod[]> {
  const normalizedOwnerScopeId = normalizeOwnerScopeId(ownerScopeId)
  const referenceDate = normalizeReferenceDate(options?.referenceDate)
  const currentFiscalYear = referenceDate.getUTCFullYear()
  const db = await resolveStore(store)
  const periods = await Promise.all(
    [currentFiscalYear - 1, currentFiscalYear].map((fiscalYear) =>
      ensureFiscalYearPeriods(normalizedOwnerScopeId, fiscalYear, db)
    )
  )

  return periods.flat()
}
