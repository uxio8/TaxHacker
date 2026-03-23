import { createHash } from "node:crypto"

export const FISCAL_PERIOD_SNAPSHOT_KIND_CLOSE = "close" as const
export const FISCAL_PERIOD_SNAPSHOT_SCHEMA_VERSION = 1 as const

const MODEL_303_RATE_KEYS = ["2100", "1000", "400"] as const

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonObject | JsonValue[]

type JsonObject = {
  [key: string]: JsonValue
}

type FiscalPeriodSnapshotInputPeriod = {
  id: string
  ownerScopeId: string
  fiscalYear: number
  quarter: number
  periodKey: string
  startsOn: string
  endsOn: string
  status: string
  countryCode: string
  currencyCode: string
}

type FiscalPeriodSnapshotInput = {
  period: FiscalPeriodSnapshotInputPeriod
  company: {
    companyName: string
    companyTaxId: string
  }
  summary: {
    review_status_counts: Record<string, number>
    model_303: Record<string, unknown>
    model_115: Record<string, unknown>
  }
  vatBooks: {
    received: unknown[]
    issued: unknown[]
  }
  generatedAt: string
}

type FiscalPeriodSnapshotPayload = {
  schema_version: typeof FISCAL_PERIOD_SNAPSHOT_SCHEMA_VERSION
  company: {
    company_name: string
    company_tax_id: string
    country_code: string
    currency_code: string
  }
  period: {
    fiscal_period_id: string
    fiscal_year: number
    quarter: number
    period_key: string
    starts_on: string
    ends_on: string
    status: string
    country_code: string
    currency_code: string
  }
  summary: {
    review_status_counts: {
      ready: number
      needs_review: number
      blocked: number
      pending: number
    }
    model_303: {
      documents_included: string[]
      output_vat_by_rate: Record<(typeof MODEL_303_RATE_KEYS)[number], { base_cents: number; vat_cents: number }>
      input_vat_deductible_by_rate: Record<
        (typeof MODEL_303_RATE_KEYS)[number],
        { base_cents: number; vat_cents: number }
      >
      input_vat_non_deductible_by_rate: Record<
        (typeof MODEL_303_RATE_KEYS)[number],
        { base_cents: number; vat_cents: number }
      >
      output_vat_total_cents: number
      input_vat_deductible_total_cents: number
      result_vat_payable_cents: number
    }
    model_115: {
      documents_included: string[]
      landlord_counterparty_ids: string[]
      perceptor_count: number
      rent_base_cents: number
      withholding_cents: number
    }
  }
  vat_books: {
    received: VatBookLine[]
    issued: VatBookLine[]
  }
}

type FiscalPeriodSnapshotRecord = {
  id: string
  ownerScopeId: string
  fiscalPeriodId: string
  snapshotKind: string
  schemaVersion: number
  payloadHash: string
  generatedAt: Date
  payload: unknown
  createdAt: Date
  updatedAt: Date
}

type FiscalPeriodSnapshot = {
  id: string
  ownerScopeId: string
  fiscalPeriodId: string
  snapshotKind: string
  schemaVersion: number
  payloadHash: string
  generatedAt: string
  payload: FiscalPeriodSnapshotPayload
  createdAt: string
  updatedAt: string
}

type FiscalPeriodSnapshotStore = {
  fiscalPeriodSnapshot: {
    findUnique(args: {
      where: {
        ownerScopeId_fiscalPeriodId_snapshotKind: {
          ownerScopeId: string
          fiscalPeriodId: string
          snapshotKind: string
        }
      }
    }): Promise<FiscalPeriodSnapshotRecord | null>
    findFirst(args: {
      where: {
        ownerScopeId: string
        fiscalPeriodId: string
        snapshotKind?: string
      }
      orderBy?: {
        updatedAt: "asc" | "desc"
      }
    }): Promise<FiscalPeriodSnapshotRecord | null>
    upsert(args: {
      where: {
        ownerScopeId_fiscalPeriodId_snapshotKind: {
          ownerScopeId: string
          fiscalPeriodId: string
          snapshotKind: string
        }
      }
      update: {
        schemaVersion: number
        payloadHash: string
        generatedAt: Date
        payload: FiscalPeriodSnapshotPayload
      }
      create: {
        ownerScopeId: string
        fiscalPeriodId: string
        snapshotKind: string
        schemaVersion: number
        payloadHash: string
        generatedAt: Date
        payload: FiscalPeriodSnapshotPayload
      }
    }): Promise<FiscalPeriodSnapshotRecord>
  }
}

type VatBookLine = {
  book_kind: string
  fiscal_document_id: string
  line_id: string
  line_number: number
  issue_date: string
  invoice_number: string | null
  counterparty_id: string | null
  counterparty_name: string | null
  counterparty_tax_id: string | null
  concept: string
  base_amount_cents: number
  vat_rate_bps: number
  vat_amount_cents: number
  deductibility_percent_bps: number
  deductible_vat_cents: number
}

type GetLatestFiscalPeriodSnapshotOptions = {
  snapshotKind?: string
}

function trimToNull(value?: string | null): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function normalizeRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} debe ser una cadena no vacia`)
  }

  const normalized = trimToNull(value)

  if (!normalized) {
    throw new Error(`${fieldName} debe ser una cadena no vacia`)
  }

  return normalized
}

function normalizeOptionalString(value: unknown): string | null {
  if (value == null) {
    return null
  }

  if (typeof value !== "string") {
    throw new Error("Los campos opcionales de texto deben ser cadenas o null")
  }

  return trimToNull(value)
}

function normalizeInteger(value: unknown, fieldName: string): number {
  if (!Number.isInteger(value)) {
    throw new Error(`${fieldName} debe ser un entero`)
  }

  return value as number
}

function normalizeDateOnly(value: unknown, fieldName: string): string {
  const normalized = normalizeRequiredString(value, fieldName)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error(`${fieldName} debe seguir el formato YYYY-MM-DD`)
  }

  const parsed = new Date(`${normalized}T00:00:00.000Z`)

  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new Error(`${fieldName} debe ser una fecha valida`)
  }

  return normalized
}

function normalizeDateTime(value: unknown, fieldName: string): string {
  const normalized = normalizeRequiredString(value, fieldName)
  const parsed = new Date(normalized)

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} debe ser una fecha ISO valida`)
  }

  return parsed.toISOString()
}

function serializeDateTime(value: Date): string {
  return value.toISOString()
}

function compareNullableStrings(left: string | null, right: string | null): number {
  return (left ?? "").localeCompare(right ?? "")
}

function compareVatBookLines(left: VatBookLine, right: VatBookLine): number {
  return (
    left.issue_date.localeCompare(right.issue_date) ||
    compareNullableStrings(left.invoice_number, right.invoice_number) ||
    left.line_number - right.line_number ||
    left.fiscal_document_id.localeCompare(right.fiscal_document_id) ||
    left.line_id.localeCompare(right.line_id)
  )
}

function normalizeStringArray(values: unknown, fieldName: string): string[] {
  if (!Array.isArray(values)) {
    throw new Error(`${fieldName} debe ser una lista`)
  }

  return values
    .map((value, index) => normalizeRequiredString(value, `${fieldName}[${index}]`))
    .sort((left, right) => left.localeCompare(right))
}

function asRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${fieldName} debe ser un objeto`)
  }

  return value as Record<string, unknown>
}

function normalizeRateBreakdown(value: unknown, fieldName: string) {
  const candidate = asRecord(value, fieldName)

  return Object.fromEntries(
    MODEL_303_RATE_KEYS.map((rateKey) => {
      const rateEntry = asRecord(candidate[rateKey], `${fieldName}.${rateKey}`)

      return [
        rateKey,
        {
          base_cents: normalizeInteger(rateEntry.base_cents, `${fieldName}.${rateKey}.base_cents`),
          vat_cents: normalizeInteger(rateEntry.vat_cents, `${fieldName}.${rateKey}.vat_cents`),
        },
      ]
    })
  ) as Record<(typeof MODEL_303_RATE_KEYS)[number], { base_cents: number; vat_cents: number }>
}

function normalizeVatBookLine(value: unknown, expectedBookKind: string, fieldName: string): VatBookLine {
  const candidate = asRecord(value, fieldName)
  const bookKind = normalizeRequiredString(candidate.book_kind, `${fieldName}.book_kind`)

  if (bookKind !== expectedBookKind) {
    throw new Error(`${fieldName}.book_kind debe ser ${expectedBookKind}`)
  }

  return {
    book_kind: bookKind,
    fiscal_document_id: normalizeRequiredString(
      candidate.fiscal_document_id,
      `${fieldName}.fiscal_document_id`
    ),
    line_id: normalizeRequiredString(candidate.line_id, `${fieldName}.line_id`),
    line_number: normalizeInteger(candidate.line_number, `${fieldName}.line_number`),
    issue_date: normalizeDateOnly(candidate.issue_date, `${fieldName}.issue_date`),
    invoice_number: normalizeOptionalString(candidate.invoice_number),
    counterparty_id: normalizeOptionalString(candidate.counterparty_id),
    counterparty_name: normalizeOptionalString(candidate.counterparty_name),
    counterparty_tax_id: normalizeOptionalString(candidate.counterparty_tax_id),
    concept: normalizeRequiredString(candidate.concept, `${fieldName}.concept`),
    base_amount_cents: normalizeInteger(candidate.base_amount_cents, `${fieldName}.base_amount_cents`),
    vat_rate_bps: normalizeInteger(candidate.vat_rate_bps, `${fieldName}.vat_rate_bps`),
    vat_amount_cents: normalizeInteger(candidate.vat_amount_cents, `${fieldName}.vat_amount_cents`),
    deductibility_percent_bps: normalizeInteger(
      candidate.deductibility_percent_bps,
      `${fieldName}.deductibility_percent_bps`
    ),
    deductible_vat_cents: normalizeInteger(
      candidate.deductible_vat_cents,
      `${fieldName}.deductible_vat_cents`
    ),
  }
}

function normalizeVatBookLines(values: unknown, expectedBookKind: string, fieldName: string): VatBookLine[] {
  if (!Array.isArray(values)) {
    throw new Error(`${fieldName} debe ser una lista`)
  }

  return values
    .map((value, index) => normalizeVatBookLine(value, expectedBookKind, `${fieldName}[${index}]`))
    .sort(compareVatBookLines)
}

function normalizePayload(input: FiscalPeriodSnapshotInput): FiscalPeriodSnapshotPayload {
  const period = input.period
  const model303 = asRecord(input.summary.model_303, "summary.model_303")
  const model115 = asRecord(input.summary.model_115, "summary.model_115")

  return {
    schema_version: FISCAL_PERIOD_SNAPSHOT_SCHEMA_VERSION,
    company: {
      company_name: normalizeRequiredString(input.company.companyName, "company.companyName"),
      company_tax_id: normalizeRequiredString(input.company.companyTaxId, "company.companyTaxId"),
      country_code: normalizeRequiredString(period.countryCode, "period.countryCode"),
      currency_code: normalizeRequiredString(period.currencyCode, "period.currencyCode"),
    },
    period: {
      fiscal_period_id: normalizeRequiredString(period.id, "period.id"),
      fiscal_year: normalizeInteger(period.fiscalYear, "period.fiscalYear"),
      quarter: normalizeInteger(period.quarter, "period.quarter"),
      period_key: normalizeRequiredString(period.periodKey, "period.periodKey"),
      starts_on: normalizeDateOnly(period.startsOn, "period.startsOn"),
      ends_on: normalizeDateOnly(period.endsOn, "period.endsOn"),
      status: normalizeRequiredString(period.status, "period.status"),
      country_code: normalizeRequiredString(period.countryCode, "period.countryCode"),
      currency_code: normalizeRequiredString(period.currencyCode, "period.currencyCode"),
    },
    summary: {
      review_status_counts: {
        ready: normalizeInteger(
          input.summary.review_status_counts.ready,
          "summary.review_status_counts.ready"
        ),
        needs_review: normalizeInteger(
          input.summary.review_status_counts.needs_review,
          "summary.review_status_counts.needs_review"
        ),
        blocked: normalizeInteger(
          input.summary.review_status_counts.blocked,
          "summary.review_status_counts.blocked"
        ),
        pending: normalizeInteger(
          input.summary.review_status_counts.pending,
          "summary.review_status_counts.pending"
        ),
      },
      model_303: {
        documents_included: normalizeStringArray(
          model303.documents_included,
          "summary.model_303.documents_included"
        ),
        output_vat_by_rate: normalizeRateBreakdown(
          model303.output_vat_by_rate,
          "summary.model_303.output_vat_by_rate"
        ),
        input_vat_deductible_by_rate: normalizeRateBreakdown(
          model303.input_vat_deductible_by_rate,
          "summary.model_303.input_vat_deductible_by_rate"
        ),
        input_vat_non_deductible_by_rate: normalizeRateBreakdown(
          model303.input_vat_non_deductible_by_rate,
          "summary.model_303.input_vat_non_deductible_by_rate"
        ),
        output_vat_total_cents: normalizeInteger(
          model303.output_vat_total_cents,
          "summary.model_303.output_vat_total_cents"
        ),
        input_vat_deductible_total_cents: normalizeInteger(
          model303.input_vat_deductible_total_cents,
          "summary.model_303.input_vat_deductible_total_cents"
        ),
        result_vat_payable_cents: normalizeInteger(
          model303.result_vat_payable_cents,
          "summary.model_303.result_vat_payable_cents"
        ),
      },
      model_115: {
        documents_included: normalizeStringArray(
          model115.documents_included,
          "summary.model_115.documents_included"
        ),
        landlord_counterparty_ids: normalizeStringArray(
          model115.landlord_counterparty_ids,
          "summary.model_115.landlord_counterparty_ids"
        ),
        perceptor_count: normalizeInteger(
          model115.perceptor_count,
          "summary.model_115.perceptor_count"
        ),
        rent_base_cents: normalizeInteger(model115.rent_base_cents, "summary.model_115.rent_base_cents"),
        withholding_cents: normalizeInteger(
          model115.withholding_cents,
          "summary.model_115.withholding_cents"
        ),
      },
    },
    vat_books: {
      received: normalizeVatBookLines(input.vatBooks.received, "received", "vatBooks.received"),
      issued: normalizeVatBookLines(input.vatBooks.issued, "issued", "vatBooks.issued"),
    },
  }
}

function stableStringify(value: JsonValue): string {
  if (value == null || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value)
  }

  if (typeof value === "string") {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`
  }

  const keys = Object.keys(value).sort((left, right) => left.localeCompare(right))

  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key] as JsonValue)}`)
    .join(",")}}`
}

function buildPayloadHash(payload: FiscalPeriodSnapshotPayload): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex")
}

function mapRecordToFiscalPeriodSnapshot(record: FiscalPeriodSnapshotRecord): FiscalPeriodSnapshot {
  return {
    id: record.id,
    ownerScopeId: record.ownerScopeId,
    fiscalPeriodId: record.fiscalPeriodId,
    snapshotKind: record.snapshotKind,
    schemaVersion: record.schemaVersion,
    payloadHash: record.payloadHash,
    generatedAt: serializeDateTime(record.generatedAt),
    payload: record.payload as FiscalPeriodSnapshotPayload,
    createdAt: serializeDateTime(record.createdAt),
    updatedAt: serializeDateTime(record.updatedAt),
  }
}

function normalizeSnapshotKind(value?: string): string {
  return normalizeRequiredString(value ?? FISCAL_PERIOD_SNAPSHOT_KIND_CLOSE, "snapshotKind")
}

async function resolveStore(store?: FiscalPeriodSnapshotStore): Promise<FiscalPeriodSnapshotStore> {
  if (store) {
    return store
  }

  const { prisma } = await import("../../lib/db.ts")
  return prisma as unknown as FiscalPeriodSnapshotStore
}

export async function replaceFiscalPeriodSnapshot(
  ownerScopeId: string,
  input: FiscalPeriodSnapshotInput,
  store?: FiscalPeriodSnapshotStore
): Promise<FiscalPeriodSnapshot> {
  const normalizedOwnerScopeId = normalizeRequiredString(ownerScopeId, "ownerScopeId")
  const payload = normalizePayload(input)

  if (normalizeRequiredString(input.period.ownerScopeId, "period.ownerScopeId") !== normalizedOwnerScopeId) {
    throw new Error("ownerScopeId del periodo debe coincidir con el ownerScopeId solicitado")
  }

  const normalizedGeneratedAt = normalizeDateTime(input.generatedAt, "generatedAt")
  const snapshotKind = FISCAL_PERIOD_SNAPSHOT_KIND_CLOSE
  const payloadHash = buildPayloadHash(payload)
  const payloadFingerprint = stableStringify(payload as JsonValue)
  const db = await resolveStore(store)
  const existing = await db.fiscalPeriodSnapshot.findUnique({
    where: {
      ownerScopeId_fiscalPeriodId_snapshotKind: {
        ownerScopeId: normalizedOwnerScopeId,
        fiscalPeriodId: payload.period.fiscal_period_id,
        snapshotKind,
      },
    },
  })

  if (existing) {
    const existingFingerprint = stableStringify(existing.payload as JsonValue)

    if (existing.payloadHash === payloadHash && existingFingerprint === payloadFingerprint) {
      return mapRecordToFiscalPeriodSnapshot(existing)
    }
  }

  const record = await db.fiscalPeriodSnapshot.upsert({
    where: {
      ownerScopeId_fiscalPeriodId_snapshotKind: {
        ownerScopeId: normalizedOwnerScopeId,
        fiscalPeriodId: payload.period.fiscal_period_id,
        snapshotKind,
      },
    },
    update: {
      schemaVersion: FISCAL_PERIOD_SNAPSHOT_SCHEMA_VERSION,
      payloadHash,
      generatedAt: new Date(normalizedGeneratedAt),
      payload,
    },
    create: {
      ownerScopeId: normalizedOwnerScopeId,
      fiscalPeriodId: payload.period.fiscal_period_id,
      snapshotKind,
      schemaVersion: FISCAL_PERIOD_SNAPSHOT_SCHEMA_VERSION,
      payloadHash,
      generatedAt: new Date(normalizedGeneratedAt),
      payload,
    },
  })

  return mapRecordToFiscalPeriodSnapshot(record)
}

export async function getLatestFiscalPeriodSnapshot(
  ownerScopeId: string,
  fiscalPeriodId: string,
  options?: GetLatestFiscalPeriodSnapshotOptions,
  store?: FiscalPeriodSnapshotStore
): Promise<FiscalPeriodSnapshot | null> {
  const normalizedOwnerScopeId = normalizeRequiredString(ownerScopeId, "ownerScopeId")
  const normalizedFiscalPeriodId = normalizeRequiredString(fiscalPeriodId, "fiscalPeriodId")
  const normalizedSnapshotKind = options?.snapshotKind
    ? normalizeSnapshotKind(options.snapshotKind)
    : undefined
  const db = await resolveStore(store)

  const record = await db.fiscalPeriodSnapshot.findFirst({
    where: {
      ownerScopeId: normalizedOwnerScopeId,
      fiscalPeriodId: normalizedFiscalPeriodId,
      snapshotKind: normalizedSnapshotKind,
    },
    orderBy: {
      updatedAt: "desc",
    },
  })

  return record ? mapRecordToFiscalPeriodSnapshot(record) : null
}
