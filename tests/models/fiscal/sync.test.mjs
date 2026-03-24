import assert from "node:assert/strict"
import test from "node:test"

import { deriveTransactionFiscalReview } from "../../../models/fiscal/review-status.ts"
import {
  assertFiscalDocumentsSyncAllowed,
  buildSyncableTransactionProjection,
  ensureFiscalDocumentsSynced,
  syncTransactionFiscalFromTransaction,
} from "../../../models/fiscal/sync.ts"

function createTransaction(overrides = {}) {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    userId: "user_1",
    name: "Servicio mensual",
    description: null,
    merchant: null,
    total: 121000,
    currencyCode: "EUR",
    convertedTotal: null,
    convertedCurrencyCode: null,
    type: "expense",
    items: [],
    note: null,
    files: [],
    extra: null,
    categoryCode: null,
    projectCode: null,
    issuedAt: new Date("2026-03-10T00:00:00.000Z"),
    createdAt: new Date("2026-03-11T09:00:00.000Z"),
    updatedAt: new Date("2026-03-11T09:00:00.000Z"),
    text: null,
    ...overrides,
  }
}

function createProfile(overrides = {}) {
  return {
    id: "fp_1",
    userId: "user_1",
    companyName: "LedgerFlow Demo SL",
    taxId: "B11223344",
    taxIdNormalized: "B11223344",
    countryCode: "ES",
    currencyCode: "EUR",
    legalEntityType: "spanish_sl",
    vatCashAccountingEnabled: false,
    ...overrides,
  }
}

function createExistingDocument(overrides = {}) {
  return {
    header: {
      fiscal_document_id: "fd_tx_77777777-7777-7777-7777-777777777777",
      source_transaction_id: "77777777-7777-7777-7777-777777777777",
      document_kind: "received_invoice",
      direction: "incoming",
      invoice_number: "REC-2026-077",
      invoice_series: null,
      issue_date: "2026-03-10",
      operation_date: null,
      payment_date: null,
      currency_code: "EUR",
      counterparty_id: null,
      counterparty_role: "supplier",
      counterparty_name: "Proveedor Demo SL",
      counterparty_tax_id: "B12345678",
      counterparty_country_code: "ES",
      company_tax_id: "B11223344",
      review_status: "ready",
      review_reasons: [],
      vat_period_assignment: {
        fiscal_year: 2026,
        quarter: 1,
        period_key: "2026-Q1",
        basis: "issue_date",
        assigned_at: "2026-03-22T10:00:00.000Z",
      },
      withholding_period_assignment: null,
      observed_amount_cents: 0,
      total_net_cents: 100000,
      total_vat_cents: 21000,
      total_withholding_cents: 0,
      total_gross_cents: 121000,
      total_payable_cents: 121000,
      source_confidence: "transaction_sync",
      notes: null,
      ...overrides.header,
    },
    lines: [
      {
        line_id: "fd_tx_77777777-7777-7777-7777-777777777777_l1",
        fiscal_document_id: "fd_tx_77777777-7777-7777-7777-777777777777",
        line_number: 1,
        concept: "Servicio mensual",
        base_amount_cents: 100000,
        vat_treatment: "taxable",
        vat_rate_bps: 2100,
        vat_amount_cents: 21000,
        withholding_applicable: false,
        withholding_regime: "none",
        withholding_base_cents: 0,
        withholding_rate_bps: 0,
        withholding_amount_cents: 0,
        deductibility_percent_bps: 10000,
        deductibility_reason: "fully_deductible",
        expense_family: "services",
        is_ready_for_vat_books: true,
        is_ready_for_withholding_books: false,
      },
    ],
    ...overrides,
  }
}

function createSyncDependencies(calls) {
  return {
    getCounterparties: async () => [],
    getTransactionFiscalBySourceTransactionId: async () => null,
    upsertTransactionFiscal: async (ownerScopeId, document, store, options) => {
      calls.push({
        ownerScopeId,
        document,
        options,
      })

      const review = deriveTransactionFiscalReview(document.header, document.lines, options)

      return {
        header: {
          ...review.header,
          review_status: review.review_status,
          review_reasons: review.review_reasons,
        },
        lines: review.lines,
      }
    },
  }
}

test("syncTransactionFiscalFromTransaction crea un documento parcial en revisión cuando faltan campos fiscales", async () => {
  const calls = []
  const transaction = createTransaction()
  const profile = createProfile()

  const result = await syncTransactionFiscalFromTransaction(transaction, profile, {
    ...createSyncDependencies(calls),
  })

  assert.equal(result.status, "synced")
  assert.equal(result.document?.header.fiscal_document_id, "fd_tx_11111111-1111-1111-1111-111111111111")
  assert.equal(result.document?.header.source_transaction_id, transaction.id)
  assert.equal(result.document?.header.document_kind, "received_invoice")
  assert.equal(result.document?.header.direction, "incoming")
  assert.equal(result.document?.header.review_status, "needs_review")
  assert.deepEqual(result.document?.header.review_reasons, ["missing_invoice_number"])
  assert.equal(result.document?.lines[0]?.vat_treatment, "out_of_scope")
  assert.equal(result.document?.lines[0]?.base_amount_cents, 121000)
  assert.deepEqual(calls, [
    {
      ownerScopeId: "fp_1",
      document: {
        header: {
          fiscal_document_id: "fd_tx_11111111-1111-1111-1111-111111111111",
          source_transaction_id: "11111111-1111-1111-1111-111111111111",
          document_kind: "received_invoice",
          direction: "incoming",
          invoice_number: null,
          invoice_series: null,
          issue_date: "2026-03-10",
          operation_date: null,
          payment_date: null,
          currency_code: "EUR",
          counterparty_id: null,
          counterparty_role: "supplier",
          counterparty_name: null,
          counterparty_tax_id: null,
          counterparty_country_code: "ES",
          company_tax_id: "B11223344",
          observed_amount_cents: 0,
          total_net_cents: 121000,
          total_vat_cents: 0,
          total_withholding_cents: 0,
          total_gross_cents: 121000,
          total_payable_cents: 121000,
          source_confidence: "transaction_sync",
          notes: "Proyección fiscal mínima derivada de Transaction; faltan campos fiscales por revisar.",
        },
        lines: [
          {
            line_id: "fd_tx_11111111-1111-1111-1111-111111111111_l1",
            fiscal_document_id: "fd_tx_11111111-1111-1111-1111-111111111111",
            line_number: 1,
            concept: "Servicio mensual",
            base_amount_cents: 121000,
            vat_treatment: "out_of_scope",
            vat_rate_bps: 0,
            vat_amount_cents: 0,
            withholding_applicable: false,
            withholding_regime: "none",
            withholding_base_cents: 0,
            withholding_rate_bps: 0,
            withholding_amount_cents: 0,
            deductibility_percent_bps: 10000,
            deductibility_reason: "fully_deductible",
            expense_family: "other",
          },
        ],
      },
      options: {
        assignedAt: transaction.updatedAt,
        vatCashAccountingEnabled: false,
      },
    },
  ])
})

test("syncTransactionFiscalFromTransaction usa payment_date para IVA cuando el perfil fiscal está en criterio de caja", async () => {
  const calls = []
  const transaction = createTransaction({
    id: "22222222-2222-2222-2222-222222222222",
    type: "income",
    merchant: "Cliente Demo SL",
    total: 242000,
    extra: {
      invoice_number: "INV-2026-007",
      vat: "420",
      vat_rate: "21",
      payment_date: "2026-04-20",
    },
  })
  const profile = createProfile({
    vatCashAccountingEnabled: true,
  })

  const result = await syncTransactionFiscalFromTransaction(transaction, profile, {
    ...createSyncDependencies(calls),
  })

  assert.equal(result.status, "synced")
  assert.equal(result.document?.header.document_kind, "issued_invoice")
  assert.equal(result.document?.header.direction, "outgoing")
  assert.equal(result.document?.header.payment_date, "2026-04-20")
  assert.equal(result.document?.header.vat_period_assignment?.basis, "payment_date")
  assert.equal(result.document?.lines[0]?.vat_treatment, "taxable")
  assert.equal(result.document?.lines[0]?.base_amount_cents, 200000)
  assert.equal(result.document?.lines[0]?.vat_rate_bps, 2100)
  assert.equal(result.document?.lines[0]?.vat_amount_cents, 42000)
  assert.equal(calls[0]?.options?.vatCashAccountingEnabled, true)
})

test("syncTransactionFiscalFromTransaction audita el auto-link conservador por NIF exacto", async () => {
  const calls = []
  const auditCalls = []
  const transaction = createTransaction({
    id: "autolink-2222-2222-2222-222222222222",
    merchant: "Proveedor Demo SL",
    extra: {
      invoice_number: "REC-2026-022",
      counterparty_name: "Proveedor Demo SL",
      counterparty_tax_id: "B12345678",
      vat: "210",
      vat_rate: "21",
    },
  })
  const profile = createProfile()

  const result = await syncTransactionFiscalFromTransaction(transaction, profile, {
    ...createSyncDependencies(calls),
    getCounterparties: async () => [
      {
        id: "cp_supplier_001",
        displayName: "Proveedor Demo SL",
        normalizedName: "PROVEEDOR DEMO SL",
        taxId: "B12345678",
        taxIdNormalized: "B12345678",
        canonicalIdentityKey: "ES:NIF:B12345678",
        isActive: true,
      },
    ],
    appendFiscalAuditEvent: async (...args) => {
      auditCalls.push(args)
      return null
    },
  })

  assert.equal(result.status, "synced")
  assert.equal(result.document?.header.counterparty_id, "cp_supplier_001")
  assert.equal(auditCalls.length, 1)
  assert.equal(auditCalls[0]?.[0], "fp_1")
  assert.equal(auditCalls[0]?.[1]?.event, "counterparty_auto_linked")
  assert.equal(auditCalls[0]?.[1]?.fiscalDocumentId, "fd_tx_autolink-2222-2222-2222-222222222222")
  assert.equal(auditCalls[0]?.[1]?.details?.chosen_counterparty_id, "cp_supplier_001")
  assert.equal(auditCalls[0]?.[1]?.details?.rule_version, "counterparty-resolution/v1")
})

test("syncTransactionFiscalFromTransaction no audita auto-link si el documento ya estaba enlazado", async () => {
  const calls = []
  const auditCalls = []
  const transaction = createTransaction({
    id: "autolink-keep-3333-3333-333333333333",
    merchant: "Proveedor Demo SL",
    extra: {
      invoice_number: "REC-2026-023",
      counterparty_name: "Proveedor Demo SL",
      counterparty_tax_id: "B12345678",
    },
  })
  const profile = createProfile()
  const existingDocument = createExistingDocument({
    header: {
      source_transaction_id: transaction.id,
      fiscal_document_id: `fd_tx_${transaction.id}`,
      counterparty_id: "cp_existing",
      counterparty_name: "Proveedor Demo SL",
      counterparty_tax_id: "B12345678",
    },
  })

  const result = await syncTransactionFiscalFromTransaction(transaction, profile, {
    ...createSyncDependencies(calls),
    getTransactionFiscalBySourceTransactionId: async () => existingDocument,
    getCounterparties: async () => [
      {
        id: "cp_supplier_001",
        displayName: "Proveedor Demo SL",
        normalizedName: "PROVEEDOR DEMO SL",
        taxId: "B12345678",
        taxIdNormalized: "B12345678",
        canonicalIdentityKey: "ES:NIF:B12345678",
        isActive: true,
      },
    ],
    appendFiscalAuditEvent: async (...args) => {
      auditCalls.push(args)
      return null
    },
  })

  assert.equal(result.status, "synced")
  assert.equal(result.document?.header.counterparty_id, "cp_existing")
  assert.equal(auditCalls.length, 0)
})

test("syncTransactionFiscalFromTransaction preserva payment_date y asignaciones persistidas si Transaction no las trae", async () => {
  const calls = []
  const transaction = createTransaction({
    id: "55555555-5555-5555-5555-555555555555",
    extra: null,
  })
  const profile = createProfile({
    vatCashAccountingEnabled: true,
  })
  const existingDocument = {
    header: {
      fiscal_document_id: "fd_tx_55555555-5555-5555-5555-555555555555",
      source_transaction_id: transaction.id,
      document_kind: "received_invoice",
      direction: "incoming",
      invoice_number: "REC-2026-055",
      invoice_series: null,
      issue_date: "2026-03-10",
      operation_date: null,
      payment_date: "2026-04-20",
      currency_code: "EUR",
      counterparty_id: "cp_1",
      counterparty_role: "supplier",
      counterparty_name: "Proveedor Demo SL",
      counterparty_tax_id: "B12345678",
      counterparty_country_code: "ES",
      company_tax_id: "B11223344",
      review_status: "needs_review",
      review_reasons: ["manual_override_required"],
      vat_period_assignment: {
        fiscal_year: 2026,
        quarter: 2,
        period_key: "2026-Q2",
        basis: "manual_override",
        assigned_at: "2026-03-22T10:00:00.000Z",
      },
      withholding_period_assignment: null,
      observed_amount_cents: 0,
      total_net_cents: 121000,
      total_vat_cents: 0,
      total_withholding_cents: 0,
      total_gross_cents: 121000,
      total_payable_cents: 121000,
      source_confidence: "transaction_sync",
      notes: null,
    },
    lines: [],
  }

  const result = await syncTransactionFiscalFromTransaction(transaction, profile, {
    ...createSyncDependencies(calls),
    getTransactionFiscalBySourceTransactionId: async () => existingDocument,
  })

  assert.equal(result.status, "synced")
  assert.equal(calls[0]?.document.header.payment_date, "2026-04-20")
  assert.deepEqual(calls[0]?.document.header.vat_period_assignment, {
    fiscal_year: 2026,
    quarter: 2,
    period_key: "2026-Q2",
    basis: "manual_override",
    assigned_at: "2026-03-22T10:00:00.000Z",
  })
  assert.equal(calls[0]?.document.header.invoice_number, "REC-2026-055")
  assert.equal(calls[0]?.document.header.counterparty_id, "cp_1")
  assert.equal(result.document?.header.payment_date, "2026-04-20")
})

test("ensureFiscalDocumentsSynced hace backfill idempotente por sourceTransactionId", async () => {
  const calls = []
  const transaction = createTransaction({
    id: "33333333-3333-3333-3333-333333333333",
  })
  const profile = createProfile()

  const result = await ensureFiscalDocumentsSynced("user_1", {
    transactions: [transaction, { ...transaction }],
    dependencies: {
      getFiscalProfileAccessByUserId: async () => ({
        status: "ready",
        profile,
      }),
      ...createSyncDependencies(calls),
    },
  })

  assert.equal(result.accessStatus, "ready")
  assert.equal(result.results.length, 1)
  assert.equal(result.results[0]?.status, "synced")
  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.document.header.source_transaction_id, "33333333-3333-3333-3333-333333333333")
})

test("ensureFiscalDocumentsSynced prioriza organizationId para resolver el perfil fiscal", async () => {
  const calls = []
  const transaction = createTransaction({
    id: "orgscope-3333-3333-3333-333333333333",
  })
  const profile = createProfile({
    id: "fp_org",
  })

  const result = await ensureFiscalDocumentsSynced("user_1", {
    organizationId: "org_1",
    transactions: [transaction],
    dependencies: {
      getFiscalProfileAccessByOrganizationId: async (organizationId, userId) => {
        assert.equal(organizationId, "org_1")
        assert.equal(userId, "user_1")
        return {
          status: "ready",
          profile,
        }
      },
      getFiscalProfileAccessByUserId: async () => {
        throw new Error("No debería usar getFiscalProfileAccessByUserId cuando hay organizationId")
      },
      ...createSyncDependencies(calls),
    },
  })

  assert.equal(result.accessStatus, "ready")
  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.ownerScopeId, "fp_org")
})

test("ensureFiscalDocumentsSynced no intenta escribir si falta el perfil fiscal", async () => {
  const calls = []
  const transaction = createTransaction({
    id: "44444444-4444-4444-4444-444444444444",
  })

  const result = await ensureFiscalDocumentsSynced("user_1", {
    transactions: [transaction],
    dependencies: {
      getFiscalProfileAccessByUserId: async () => ({
        status: "profile_missing",
        profile: null,
      }),
      ...createSyncDependencies(calls),
    },
  })

  assert.equal(result.accessStatus, "profile_missing")
  assert.deepEqual(result.results, [
    {
      sourceTransactionId: "44444444-4444-4444-4444-444444444444",
      status: "skipped_profile_missing",
      document: null,
    },
  ])
  assert.equal(calls.length, 0)
})

test("buildSyncableTransactionProjection mezcla cambios del formulario con extra ya persistido", () => {
  const projected = buildSyncableTransactionProjection({
    id: "proj_1",
    userId: "user_1",
    current: {
      name: "Documento anterior",
      merchant: "Proveedor previo",
      total: 121000,
      currencyCode: "EUR",
      type: "expense",
      extra: {
        invoice_number: "REC-2026-100",
        legacy_flag: "keep",
      },
      issuedAt: new Date("2026-03-01T00:00:00.000Z"),
      createdAt: new Date("2026-03-01T09:00:00.000Z"),
      updatedAt: new Date("2026-03-01T09:00:00.000Z"),
    },
    data: {
      name: "Documento actualizado",
      merchant: "Proveedor Demo SL",
      total: 99000,
      payment_date: "2026-04-20",
    },
    updatedAt: new Date("2026-03-22T12:00:00.000Z"),
  })

  assert.equal(projected.name, "Documento actualizado")
  assert.equal(projected.merchant, "Proveedor Demo SL")
  assert.equal(projected.total, 99000)
  assert.deepEqual(projected.extra, {
    invoice_number: "REC-2026-100",
    legacy_flag: "keep",
    payment_date: "2026-04-20",
  })
  assert.equal(projected.createdAt.toISOString(), "2026-03-01T09:00:00.000Z")
  assert.equal(projected.updatedAt.toISOString(), "2026-03-22T12:00:00.000Z")
})

test("assertFiscalDocumentsSyncAllowed previsualiza el siguiente documento fiscal antes de escribir", async () => {
  const calls = []
  const transaction = createTransaction({
    id: "66666666-6666-6666-6666-666666666666",
    merchant: "Proveedor Demo SL",
    extra: {
      invoice_number: "REC-2026-066",
      counterparty_tax_id: "B12345678",
    },
  })
  const profile = createProfile()

  const result = await assertFiscalDocumentsSyncAllowed("user_1", {
    transactions: [transaction],
    actor: {
      type: "user",
      id: "user_1",
    },
    occurredAt: "2026-03-22T12:15:00.000Z",
    dependencies: {
      getFiscalProfileAccessByUserId: async () => ({
        status: "ready",
        profile,
      }),
      getCounterparties: async () => [],
      getTransactionFiscalBySourceTransactionId: async () => null,
      assertFiscalDocumentMutationAllowed: async (input) => {
        calls.push(input)
      },
    },
  })

  assert.equal(result.accessStatus, "ready")
  assert.deepEqual(result.checkedTransactionIds, [transaction.id])
  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.currentDocument, null)
  assert.equal(calls[0]?.nextDocument?.header.source_transaction_id, transaction.id)
  assert.equal(calls[0]?.nextDocument?.header.invoice_number, "REC-2026-066")
  assert.equal(calls[0]?.nextDocument?.header.vat_period_assignment?.period_key, "2026-Q1")
  assert.equal(calls[0]?.actor.type, "user")
  assert.equal(calls[0]?.actor.id, "user_1")
})

test("assertFiscalDocumentsSyncAllowed usa nextDocument=null cuando se valida un borrado", async () => {
  const calls = []
  const transaction = createTransaction({
    id: "77777777-7777-7777-7777-777777777777",
  })
  const profile = createProfile()
  const existingDocument = createExistingDocument()

  const result = await assertFiscalDocumentsSyncAllowed("user_1", {
    transactions: [transaction],
    deleteMode: true,
    actor: {
      type: "user",
      id: "user_1",
    },
    dependencies: {
      getFiscalProfileAccessByUserId: async () => ({
        status: "ready",
        profile,
      }),
      getCounterparties: async () => [],
      getTransactionFiscalBySourceTransactionId: async () => existingDocument,
      assertFiscalDocumentMutationAllowed: async (input) => {
        calls.push(input)
      },
    },
  })

  assert.equal(result.accessStatus, "ready")
  assert.deepEqual(result.checkedTransactionIds, [transaction.id])
  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.currentDocument?.header.fiscal_document_id, existingDocument.header.fiscal_document_id)
  assert.equal(calls[0]?.nextDocument, null)
})

test("assertFiscalDocumentsSyncAllowed prioriza organizationId para validar mutaciones fiscales", async () => {
  const calls = []
  const transaction = createTransaction({
    id: "orgscope-7777-7777-7777-777777777777",
  })
  const profile = createProfile({
    id: "fp_org_assert",
  })

  const result = await assertFiscalDocumentsSyncAllowed("user_1", {
    organizationId: "org_1",
    transactions: [transaction],
    dependencies: {
      getFiscalProfileAccessByOrganizationId: async (organizationId, userId) => {
        assert.equal(organizationId, "org_1")
        assert.equal(userId, "user_1")
        return {
          status: "ready",
          profile,
        }
      },
      getFiscalProfileAccessByUserId: async () => {
        throw new Error("No debería usar getFiscalProfileAccessByUserId cuando hay organizationId")
      },
      getCounterparties: async () => [],
      getTransactionFiscalBySourceTransactionId: async () => null,
      assertFiscalDocumentMutationAllowed: async (input) => {
        calls.push(input)
      },
    },
  })

  assert.equal(result.accessStatus, "ready")
  assert.deepEqual(result.checkedTransactionIds, [transaction.id])
  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.ownerScopeId, "fp_org_assert")
})
