import type { FiscalProfile, Transaction } from "../../prisma/client/index.js"
import {
  FISCAL_AUDIT_EVENT_COUNTERPARTY_AUTO_LINKED,
  appendFiscalAuditEvent,
} from "./audit-log.ts"
import { assertFiscalDocumentMutationAllowed } from "./close.ts"
import {
  COUNTERPARTY_RESOLUTION_DECISION,
  resolveCounterpartyResolution,
  type CounterpartyResolution,
  type CounterpartyResolutionCounterpartyInput,
} from "./counterparty-resolution.ts"
import { getCounterparties } from "./counterparties.ts"
import { deriveTransactionFiscalReview } from "./review-status.ts"
import {
  getTransactionFiscalBySourceTransactionId,
  upsertTransactionFiscal,
  type TransactionFiscalDocument,
  type TransactionFiscalDocumentInput,
  type TransactionFiscalPersistenceOptions,
} from "./transaction-fiscal.ts"
import {
  getFiscalProfileAccessByOrganizationId,
  getFiscalProfileAccessByUserId,
  type FiscalProfileAccess,
} from "./profile.ts"

export type SyncableTransaction = Pick<
  Transaction,
  | "id"
  | "userId"
  | "name"
  | "description"
  | "merchant"
  | "total"
  | "currencyCode"
  | "type"
  | "extra"
  | "issuedAt"
  | "createdAt"
  | "updatedAt"
>

type SyncDependencies = {
  getTransactionFiscalBySourceTransactionId?: typeof getTransactionFiscalBySourceTransactionId
  upsertTransactionFiscal?: typeof upsertTransactionFiscal
  getCounterparties?: typeof getCounterparties
}

type EnsureDependencies = SyncDependencies & {
  getFiscalProfileAccessByUserId?: typeof getFiscalProfileAccessByUserId
  getFiscalProfileAccessByOrganizationId?: typeof getFiscalProfileAccessByOrganizationId
}

type AssertDependencies = EnsureDependencies & {
  assertFiscalDocumentMutationAllowed?: typeof assertFiscalDocumentMutationAllowed
}

export type TransactionFiscalSyncResult = {
  sourceTransactionId: string
  status: "synced" | "skipped_profile_missing" | "skipped_storage_not_ready"
  document: TransactionFiscalDocument | null
}

export type EnsureFiscalDocumentsSyncedResult = {
  accessStatus: FiscalProfileAccess["status"]
  results: TransactionFiscalSyncResult[]
}

export type AssertFiscalDocumentsSyncAllowedResult = {
  accessStatus: FiscalProfileAccess["status"]
  checkedTransactionIds: string[]
}

export type FiscalSyncAuditActor = {
  type: string
  id?: string | null
}

type SyncableTransactionProjectionInput = {
  id: string
  userId: string
  current?: Partial<SyncableTransaction> | null
  data: Record<string, unknown>
  defaultType?: string | null
  defaultCurrencyCode?: string | null
  updatedAt?: Date
}

const SYNCABLE_STANDARD_KEYS = new Set([
  "name",
  "merchant",
  "description",
  "type",
  "total",
  "currencyCode",
  "convertedTotal",
  "convertedCurrencyCode",
  "categoryCode",
  "projectCode",
  "issuedAt",
  "text",
  "note",
  "items",
  "files",
  "transactionId",
])

function trimToNull(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  return normalized ? normalized : null
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function readFirstString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const normalized = trimToNull(source[key])
    if (normalized) {
      return normalized
    }
  }

  return null
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim().replace(",", ".")
  if (!normalized) {
    return null
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function parseMoneyToCents(value: unknown): number | null {
  const parsed = parseNumber(value)
  return parsed === null ? null : Math.round(parsed * 100)
}

function parseRateToBps(value: unknown): number | null {
  const parsed = parseNumber(value)
  return parsed === null ? null : Math.round(parsed * 100)
}

function parseDateOnly(value: unknown): string | null {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  if (!normalized) {
    return null
  }

  return normalized.slice(0, 10)
}

function parseFiscalPeriodAssignment(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const candidate = value as Record<string, unknown>
  const fiscalYear = parseNumber(candidate.fiscal_year)
  const quarter = parseNumber(candidate.quarter)
  const periodKey = trimToNull(candidate.period_key)
  const basis = trimToNull(candidate.basis)
  const assignedAt = trimToNull(candidate.assigned_at)

  if (
    fiscalYear === null ||
    quarter === null ||
    !periodKey ||
    !basis ||
    !assignedAt
  ) {
    return null
  }

  return {
    fiscal_year: fiscalYear,
    quarter,
    period_key: periodKey,
    basis,
    assigned_at: assignedAt,
  }
}

function readNullableString(value: unknown, fallback: string | null = null): string | null {
  return trimToNull(value) ?? fallback
}

function readNullableNumber(value: unknown, fallback: number | null = null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function readNullableDate(value: unknown, fallback: Date | null = null): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }

  if (typeof value === "string") {
    const normalized = value.trim()
    if (!normalized) {
      return fallback
    }

    const parsed = new Date(normalized)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }

  return fallback
}

function buildProjectedExtra(
  currentExtra: unknown,
  data: Record<string, unknown>
): Record<string, unknown> | null {
  const projectedExtra: Record<string, unknown> = {
    ...asRecord(currentExtra),
  }

  for (const [key, value] of Object.entries(data)) {
    if (SYNCABLE_STANDARD_KEYS.has(key) || typeof value === "undefined") {
      continue
    }

    projectedExtra[key] = value
  }

  return Object.keys(projectedExtra).length > 0 ? projectedExtra : null
}

function buildReviewedTransactionFiscalDocument(
  transaction: SyncableTransaction,
  profile: FiscalProfile,
  existingDocument: TransactionFiscalDocument | null,
  counterparties: CounterpartyResolutionCounterpartyInput[]
): TransactionFiscalDocument {
  const { document } = applyCounterpartyResolutionToDocument(
    buildTransactionFiscalDocument(transaction, profile, existingDocument),
    counterparties,
    profile.id
  )
  const review = deriveTransactionFiscalReview(
    document.header,
    document.lines,
    buildPersistenceOptions(transaction, profile)
  )

  return {
    header: {
      ...review.header,
      review_status: review.review_status,
      review_reasons: review.review_reasons,
    },
    lines: review.lines,
  }
}

function applyCounterpartyResolutionToDocument(
  document: TransactionFiscalDocumentInput,
  counterparties: CounterpartyResolutionCounterpartyInput[],
  ownerScopeId: string
): {
  document: TransactionFiscalDocumentInput
  resolution: CounterpartyResolution | null
} {
  if (document.header.counterparty_id) {
    return {
      document,
      resolution: null,
    }
  }

  const resolution = resolveCounterpartyResolution({
    ownerScopeId,
    document: {
      fiscal_document_id: document.header.fiscal_document_id,
      source_transaction_id: document.header.source_transaction_id,
      document_kind: trimToNull(document.header.document_kind),
      counterparty_id: trimToNull(document.header.counterparty_id),
      counterparty_name: trimToNull(document.header.counterparty_name),
      counterparty_tax_id: trimToNull(document.header.counterparty_tax_id),
      counterparty_role: trimToNull(document.header.counterparty_role),
      issue_date: parseDateOnly(document.header.issue_date),
      total_payable_cents:
        typeof document.header.total_payable_cents === "number"
          ? document.header.total_payable_cents
          : null,
      total_vat_cents:
        typeof document.header.total_vat_cents === "number"
          ? document.header.total_vat_cents
          : null,
      total_withholding_cents:
        typeof document.header.total_withholding_cents === "number"
          ? document.header.total_withholding_cents
          : null,
    },
    counterparties,
  })

  if (
    resolution.decision !== COUNTERPARTY_RESOLUTION_DECISION.AUTO_LINKED ||
    !resolution.linked_counterparty_id
  ) {
    return {
      document,
      resolution,
    }
  }

  return {
    document: {
      ...document,
      header: {
        ...document.header,
        counterparty_id: resolution.linked_counterparty_id,
      },
    },
    resolution,
  }
}

export function buildSyncableTransactionProjection(
  input: SyncableTransactionProjectionInput
): SyncableTransaction {
  const current = input.current ?? null
  const updatedAt = input.updatedAt ?? new Date()

  return {
    id: input.id,
    userId: input.userId,
    name: readNullableString(input.data.name, readNullableString(current?.name)),
    description: readNullableString(
      input.data.description,
      readNullableString(current?.description)
    ),
    merchant: readNullableString(input.data.merchant, readNullableString(current?.merchant)),
    total: readNullableNumber(input.data.total, readNullableNumber(current?.total)),
    currencyCode: readNullableString(
      input.data.currencyCode,
      readNullableString(current?.currencyCode, input.defaultCurrencyCode ?? null)
    ),
    type: readNullableString(input.data.type, readNullableString(current?.type, input.defaultType ?? null)),
    extra: buildProjectedExtra(current?.extra, input.data) as SyncableTransaction["extra"],
    issuedAt: readNullableDate(input.data.issuedAt, readNullableDate(current?.issuedAt)),
    createdAt:
      current?.createdAt instanceof Date && !Number.isNaN(current.createdAt.getTime())
        ? current.createdAt
        : updatedAt,
    updatedAt,
  }
}

function buildBaseLineAmounts(transaction: SyncableTransaction, extra: Record<string, unknown>) {
  const totalGrossCents: number = typeof transaction.total === "number" ? transaction.total : 0
  const vatAmountCents =
    parseMoneyToCents(extra.vat_amount) ??
    parseMoneyToCents(extra.vat) ??
    parseMoneyToCents(extra.total_vat) ??
    0
  const vatRateBps =
    parseRateToBps(extra.vat_rate_bps) ??
    parseRateToBps(extra.vat_rate) ??
    parseRateToBps(extra.vat_percent) ??
    0
  const hasVat = vatAmountCents > 0 || vatRateBps > 0
  const baseAmountCents = hasVat ? Math.max(totalGrossCents - vatAmountCents, 0) : totalGrossCents

  return {
    baseAmountCents,
    totalGrossCents,
    vatAmountCents,
    vatRateBps,
    vatTreatment: hasVat ? "taxable" : "out_of_scope",
  }
}

function buildTransactionFiscalDocument(
  transaction: SyncableTransaction,
  profile: FiscalProfile,
  existingDocument: TransactionFiscalDocument | null
): TransactionFiscalDocumentInput {
  const extra = asRecord(transaction.extra)
  const documentKind = transaction.type === "income" ? "issued_invoice" : "received_invoice"
  const direction = transaction.type === "income" ? "outgoing" : "incoming"
  const fiscalDocumentId =
    existingDocument?.header.fiscal_document_id ?? `fd_tx_${transaction.id}`
  const issueDate =
    parseDateOnly(transaction.issuedAt) ??
    parseDateOnly(transaction.createdAt) ??
    parseDateOnly(transaction.updatedAt)
  const paymentDate =
    parseDateOnly(extra.payment_date) ??
    parseDateOnly(extra.paymentDate) ??
    existingDocument?.header.payment_date ??
    null
  const operationDate =
    parseDateOnly(extra.operation_date) ??
    parseDateOnly(extra.operationDate) ??
    existingDocument?.header.operation_date ??
    null
  const invoiceNumber =
    readFirstString(extra, ["invoice_number", "invoiceNumber"]) ??
    existingDocument?.header.invoice_number ??
    null
  const invoiceSeries =
    readFirstString(extra, ["invoice_series", "invoiceSeries"]) ??
    existingDocument?.header.invoice_series ??
    null
  const counterpartyId =
    readFirstString(extra, ["counterparty_id", "counterpartyId"]) ??
    existingDocument?.header.counterparty_id ??
    null
  const counterpartyName =
    readFirstString(extra, [
      "counterparty_name",
      "counterpartyName",
      "billing_company_name",
      "billingCompanyName",
    ]) ??
    existingDocument?.header.counterparty_name ??
    trimToNull(transaction.merchant) ??
    null
  const counterpartyTaxId =
    readFirstString(extra, [
      "counterparty_tax_id",
      "counterpartyTaxId",
      "billing_tax_id",
      "billingTaxId",
    ]) ??
    existingDocument?.header.counterparty_tax_id ??
    null
  const counterpartyCountryCode =
    readFirstString(extra, ["counterparty_country_code", "counterpartyCountryCode"]) ??
    existingDocument?.header.counterparty_country_code ??
    "ES"
  const counterpartyRole =
    readFirstString(extra, ["counterparty_role", "counterpartyRole"]) ??
    existingDocument?.header.counterparty_role ??
    (direction === "outgoing" ? "customer" : "supplier")
  const vatPeriodAssignment =
    parseFiscalPeriodAssignment(extra.vat_period_assignment) ??
    existingDocument?.header.vat_period_assignment ??
    null
  const withholdingPeriodAssignment =
    parseFiscalPeriodAssignment(extra.withholding_period_assignment) ??
    existingDocument?.header.withholding_period_assignment ??
    null
  const { baseAmountCents, totalGrossCents, vatAmountCents, vatRateBps, vatTreatment } =
    buildBaseLineAmounts(transaction, extra)
  const withholdingRegime =
    readFirstString(extra, ["withholding_regime", "withholdingRegime"]) ?? "none"
  const withholdingApplicable =
    withholdingRegime !== "none" &&
    ((parseMoneyToCents(extra.withholding_amount) ??
      parseMoneyToCents(extra.withholding) ??
      0) > 0 ||
      (parseRateToBps(extra.withholding_rate_bps) ??
        parseRateToBps(extra.withholding_rate) ??
        0) > 0)
  const withholdingAmountCents = withholdingApplicable
    ? parseMoneyToCents(extra.withholding_amount) ??
      parseMoneyToCents(extra.withholding) ??
      0
    : 0
  const withholdingRateBps = withholdingApplicable
    ? parseRateToBps(extra.withholding_rate_bps) ??
      parseRateToBps(extra.withholding_rate) ??
      0
    : 0
  const withholdingBaseCents = withholdingApplicable
    ? parseMoneyToCents(extra.withholding_base) ?? baseAmountCents
    : 0
  const deductibilityPercentBps = direction === "incoming" ? 10000 : 0
  const deductibilityReason = direction === "incoming" ? "fully_deductible" : "not_applicable"
  const expenseFamily =
    direction === "incoming"
      ? readFirstString(extra, ["expense_family", "expenseFamily"]) ?? "other"
      : "none"

  return {
    header: {
      fiscal_document_id: fiscalDocumentId,
      source_transaction_id: transaction.id,
      document_kind: documentKind,
      direction,
      invoice_number: invoiceNumber,
      invoice_series: invoiceSeries,
      issue_date: issueDate,
      operation_date: operationDate,
      payment_date: paymentDate,
      currency_code: trimToNull(transaction.currencyCode) ?? profile.currencyCode,
      counterparty_id: counterpartyId,
      counterparty_role: counterpartyRole,
      counterparty_name: counterpartyName,
      counterparty_tax_id: counterpartyTaxId,
      counterparty_country_code: counterpartyCountryCode,
      company_tax_id: profile.taxIdNormalized,
      ...(vatPeriodAssignment ? { vat_period_assignment: vatPeriodAssignment } : {}),
      ...(withholdingPeriodAssignment
        ? { withholding_period_assignment: withholdingPeriodAssignment }
        : {}),
      observed_amount_cents: 0,
      total_net_cents: baseAmountCents,
      total_vat_cents: vatAmountCents,
      total_withholding_cents: withholdingAmountCents,
      total_gross_cents: totalGrossCents,
      total_payable_cents: totalGrossCents - withholdingAmountCents,
      source_confidence: existingDocument?.header.source_confidence ?? "transaction_sync",
      notes:
        existingDocument?.header.notes ??
        "Proyección fiscal mínima derivada de Transaction; faltan campos fiscales por revisar.",
    },
    lines: [
      {
        line_id: `${fiscalDocumentId}_l1`,
        fiscal_document_id: fiscalDocumentId,
        line_number: 1,
        concept:
          trimToNull(transaction.name) ??
          trimToNull(transaction.description) ??
          trimToNull(transaction.merchant) ??
          "Transaction",
        base_amount_cents: baseAmountCents,
        vat_treatment: vatTreatment,
        vat_rate_bps: vatRateBps,
        vat_amount_cents: vatAmountCents,
        withholding_applicable: withholdingApplicable,
        withholding_regime: withholdingApplicable ? withholdingRegime : "none",
        withholding_base_cents: withholdingBaseCents,
        withholding_rate_bps: withholdingRateBps,
        withholding_amount_cents: withholdingAmountCents,
        deductibility_percent_bps: deductibilityPercentBps,
        deductibility_reason: deductibilityReason,
        expense_family: expenseFamily,
      },
    ],
  }
}

function buildPersistenceOptions(
  transaction: SyncableTransaction,
  profile: FiscalProfile
): TransactionFiscalPersistenceOptions {
  return {
    assignedAt: transaction.updatedAt,
    vatCashAccountingEnabled: profile.vatCashAccountingEnabled,
  }
}

function dedupeTransactionsById(transactions: SyncableTransaction[]): SyncableTransaction[] {
  const unique = new Map<string, SyncableTransaction>()

  for (const transaction of transactions) {
    if (!unique.has(transaction.id)) {
      unique.set(transaction.id, transaction)
    }
  }

  return [...unique.values()]
}

export async function syncTransactionFiscalFromTransaction(
  transaction: SyncableTransaction,
  profile: FiscalProfile,
  dependencies: SyncDependencies = {}
): Promise<TransactionFiscalSyncResult> {
  const getExistingDocument =
    dependencies.getTransactionFiscalBySourceTransactionId ??
    getTransactionFiscalBySourceTransactionId
  const persistDocument = dependencies.upsertTransactionFiscal ?? upsertTransactionFiscal
  const listCounterparties = dependencies.getCounterparties ?? getCounterparties
  const existingDocument = await getExistingDocument(transaction.id, profile.id)
  const counterparties = await listCounterparties(profile.id)
  const { document, resolution } = applyCounterpartyResolutionToDocument(
    buildTransactionFiscalDocument(transaction, profile, existingDocument),
    counterparties,
    profile.id
  )
  const persisted = await persistDocument(
    profile.id,
    document,
    undefined,
    buildPersistenceOptions(transaction, profile)
  )

  if (
    resolution?.decision === COUNTERPARTY_RESOLUTION_DECISION.AUTO_LINKED &&
    resolution.linked_counterparty_id &&
    !existingDocument?.header.counterparty_id
  ) {
    await appendFiscalAuditEvent(profile.id, {
      event: FISCAL_AUDIT_EVENT_COUNTERPARTY_AUTO_LINKED,
      fiscalDocumentId: persisted.header.fiscal_document_id,
      actor: {
        type: "system",
        id: null,
      },
      reason: "Auto-link conservador por NIF exacto",
      occurredAt: transaction.updatedAt,
      details: {
        rule_version: resolution.rule_version,
        materiality_bucket: resolution.materiality_bucket,
        chosen_counterparty_id: resolution.linked_counterparty_id,
        detected_counterparty_tax_id: document.header.counterparty_tax_id,
        normalized_counterparty_tax_id: resolution.evidence.normalized_tax_id,
      },
    })
  }

  return {
    sourceTransactionId: transaction.id,
    status: "synced",
    document: persisted,
  }
}

export async function assertFiscalDocumentsSyncAllowed(
  userId: string,
  input: {
    organizationId?: string | null
    transactions: SyncableTransaction[]
    deleteMode?: boolean
    actor?: FiscalSyncAuditActor
    occurredAt?: string | Date | null
    dependencies?: AssertDependencies
  }
): Promise<AssertFiscalDocumentsSyncAllowedResult> {
  const getAccessByUserId =
    input.dependencies?.getFiscalProfileAccessByUserId ?? getFiscalProfileAccessByUserId
  const getAccessByOrganizationId =
    input.dependencies?.getFiscalProfileAccessByOrganizationId ?? getFiscalProfileAccessByOrganizationId
  const getExistingDocument =
    input.dependencies?.getTransactionFiscalBySourceTransactionId ??
    getTransactionFiscalBySourceTransactionId
  const listCounterparties = input.dependencies?.getCounterparties ?? getCounterparties
  const assertAllowed =
    input.dependencies?.assertFiscalDocumentMutationAllowed ??
    assertFiscalDocumentMutationAllowed
  const access = input.organizationId
    ? await getAccessByOrganizationId(input.organizationId, userId)
    : await getAccessByUserId(userId)
  const transactions = dedupeTransactionsById(input.transactions)

  if (access.status !== "ready") {
    return {
      accessStatus: access.status,
      checkedTransactionIds: [],
    }
  }

  const counterparties = await listCounterparties(access.profile.id)

  for (const transaction of transactions) {
    const currentDocument = await getExistingDocument(transaction.id, access.profile.id)
    const nextDocument = input.deleteMode
      ? null
      : buildReviewedTransactionFiscalDocument(
          transaction,
          access.profile,
          currentDocument,
          counterparties
        )

    await assertAllowed({
      ownerScopeId: access.profile.id,
      fiscalDocumentId:
        currentDocument?.header.fiscal_document_id ??
        nextDocument?.header.fiscal_document_id ??
        null,
      currentDocument,
      nextDocument,
      actor: {
        type: trimToNull(input.actor?.type) ?? "system",
        id: trimToNull(input.actor?.id),
      },
      occurredAt: input.occurredAt ?? transaction.updatedAt,
    })
  }

  return {
    accessStatus: access.status,
    checkedTransactionIds: transactions.map((transaction) => transaction.id),
  }
}

export async function ensureFiscalDocumentsSynced(
  userId: string,
  input: {
    organizationId?: string | null
    transactions: SyncableTransaction[]
    dependencies?: EnsureDependencies
  }
): Promise<EnsureFiscalDocumentsSyncedResult> {
  const getAccessByUserId =
    input.dependencies?.getFiscalProfileAccessByUserId ?? getFiscalProfileAccessByUserId
  const getAccessByOrganizationId =
    input.dependencies?.getFiscalProfileAccessByOrganizationId ?? getFiscalProfileAccessByOrganizationId
  const access = input.organizationId
    ? await getAccessByOrganizationId(input.organizationId, userId)
    : await getAccessByUserId(userId)
  const transactions = dedupeTransactionsById(input.transactions)

  if (access.status !== "ready") {
    return {
      accessStatus: access.status,
      results: transactions.map((transaction) => ({
        sourceTransactionId: transaction.id,
        status:
          access.status === "storage_not_ready"
            ? "skipped_storage_not_ready"
            : "skipped_profile_missing",
        document: null,
      })),
    }
  }

  const results: TransactionFiscalSyncResult[] = []

  for (const transaction of transactions) {
    results.push(
      await syncTransactionFiscalFromTransaction(transaction, access.profile, input.dependencies)
    )
  }

  return {
    accessStatus: access.status,
    results,
  }
}
