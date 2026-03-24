import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  FISCAL_AUDIT_EVENT_FISCAL_DOCUMENT_EDIT_BLOCKED,
  FISCAL_AUDIT_EVENT_FISCAL_DOCUMENT_EDITED,
} from "../../../models/fiscal/audit-log.ts"
import {
  getTransactionFiscalById,
  getTransactionFiscalBySourceTransactionId,
  listTransactionFiscalDocuments,
  upsertTransactionFiscal,
} from "../../../models/fiscal/transaction-fiscal.ts"

function loadGoldenQuarter() {
  return JSON.parse(
    readFileSync(new URL("../../fixtures/fiscal/golden-quarter.json", import.meta.url), "utf8")
  )
}

function getGoldenDocument(caseId) {
  const document = loadGoldenQuarter().documents.find((entry) => entry.case_id === caseId)

  assert.ok(document, `No existe el caso ${caseId} en el golden quarter`)
  return document
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

function createStoredTransactionFiscalRecord(document, overrides = {}) {
  return {
    id: document.header.fiscal_document_id,
    ownerScopeId: "fp_1",
    sourceTransactionId: document.header.source_transaction_id,
    documentKind: document.header.document_kind,
    direction: document.header.direction,
    invoiceNumber: document.header.invoice_number,
    invoiceSeries: document.header.invoice_series,
    issueDate: document.header.issue_date
      ? new Date(`${document.header.issue_date}T00:00:00.000Z`)
      : new Date("2026-01-01T00:00:00.000Z"),
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
    reviewStatus: document.header.review_status ?? "ready",
    reviewReasons: document.header.review_reasons ?? [],
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

function createGuardedTransactionFiscalStore({
  existingDocument = null,
  persistedDocument = null,
  periodStatuses = {},
} = {}) {
  const writes = []
  const auditEvents = []

  return {
    writes,
    auditEvents,
    store: {
      transactionFiscal: {
        findFirst: async (args) => {
          if (!existingDocument) {
            return null
          }

          if (
            args.where?.sourceTransactionId === existingDocument.header.source_transaction_id ||
            args.where?.id === existingDocument.header.fiscal_document_id
          ) {
            return createStoredTransactionFiscalRecord(existingDocument)
          }

          return null
        },
        upsert: async (args) => {
          writes.push(args)
          return createStoredTransactionFiscalRecord(persistedDocument ?? existingDocument)
        },
      },
      fiscalPeriod: {
        findUnique: async (args) => {
          const key =
            args.where.ownerScopeId_periodKey?.periodKey ??
            `${args.where.ownerScopeId_fiscalYear_quarter?.fiscalYear}-Q${args.where.ownerScopeId_fiscalYear_quarter?.quarter}`
          const status = periodStatuses[key]

          if (!status) {
            return null
          }

          return {
            id: `period_${key.toLowerCase()}`,
            ownerScopeId: "fp_1",
            fiscalYear: Number.parseInt(key.slice(0, 4), 10),
            quarter: Number.parseInt(key.slice(-1), 10),
            periodKey: key,
            startsOn: new Date("2026-01-01T00:00:00.000Z"),
            endsOn: new Date("2026-03-31T00:00:00.000Z"),
            status,
            countryCode: "ES",
            currencyCode: "EUR",
            createdAt: new Date("2026-03-21T09:00:00.000Z"),
            updatedAt: new Date("2026-03-21T09:00:00.000Z"),
          }
        },
      },
      fiscalAuditLog: {
        create: async (args) => {
          const event = {
            id: `audit_${String(auditEvents.length + 1).padStart(3, "0")}`,
            ...args.data,
            createdAt: args.data.occurredAt,
          }

          auditEvents.push(event)
          return event
        },
      },
    },
  }
}

test("upsertTransactionFiscal persiste cabecera y lineas con review_status derivado", async () => {
  const golden = getGoldenDocument("received-rent-withholding")
  const calls = []

  const store = {
    transactionFiscal: {
      findFirst: async () => null,
      findUnique: async () => null,
      upsert: async (args) => {
        calls.push(args)

        return {
          id: golden.document.header.fiscal_document_id,
          ownerScopeId: "fp_1",
          sourceTransactionId: golden.document.header.source_transaction_id,
          documentKind: golden.document.header.document_kind,
          direction: golden.document.header.direction,
          invoiceNumber: golden.document.header.invoice_number,
          invoiceSeries: golden.document.header.invoice_series,
          issueDate: new Date(`${golden.document.header.issue_date}T00:00:00.000Z`),
          operationDate: null,
          paymentDate: null,
          currencyCode: golden.document.header.currency_code,
          counterpartyId: golden.document.header.counterparty_id,
          counterpartyRole: golden.document.header.counterparty_role,
          counterpartyName: golden.document.header.counterparty_name,
          counterpartyTaxId: golden.document.header.counterparty_tax_id,
          counterpartyCountryCode: golden.document.header.counterparty_country_code,
          companyTaxId: golden.document.header.company_tax_id,
          reviewStatus: "ready",
          reviewReasons: [],
          vatPeriodAssignment: golden.document.header.vat_period_assignment,
          withholdingPeriodAssignment: golden.document.header.withholding_period_assignment,
          observedAmountCents: golden.document.header.observed_amount_cents,
          totalNetCents: golden.document.header.total_net_cents,
          totalVatCents: golden.document.header.total_vat_cents,
          totalWithholdingCents: golden.document.header.total_withholding_cents,
          totalGrossCents: golden.document.header.total_gross_cents,
          totalPayableCents: golden.document.header.total_payable_cents,
          sourceConfidence: golden.document.header.source_confidence,
          notes: golden.document.header.notes,
          createdAt: new Date("2026-03-21T09:00:00.000Z"),
          updatedAt: new Date("2026-03-21T09:00:00.000Z"),
          lines: golden.document.lines.map((line) => ({
            id: line.line_id,
            transactionFiscalId: golden.document.header.fiscal_document_id,
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
            isReadyForVatBooks: true,
            isReadyForWithholdingBooks: true,
            createdAt: new Date("2026-03-21T09:00:00.000Z"),
            updatedAt: new Date("2026-03-21T09:00:00.000Z"),
          })),
        }
      },
    },
  }

  const document = await upsertTransactionFiscal("fp_1", golden.document, store)

  assert.equal(document.header.review_status, "ready")
  assert.deepEqual(document.header.review_reasons, [])
  assert.equal(document.lines[0]?.is_ready_for_vat_books, true)
  assert.equal(document.lines[0]?.is_ready_for_withholding_books, true)
  assert.deepEqual(calls, [
    {
      where: {
        ownerScopeId_sourceTransactionId: {
          ownerScopeId: "fp_1",
          sourceTransactionId: "tx_q1_002",
        },
      },
      update: {
        counterpartyId: "cp_inmuebles_gran_via_sl",
        documentKind: "received_invoice",
        direction: "incoming",
        invoiceNumber: "ALQ-2026-02",
        invoiceSeries: null,
        issueDate: new Date("2026-02-01T00:00:00.000Z"),
        operationDate: null,
        paymentDate: null,
        currencyCode: "EUR",
        counterpartyRole: "landlord",
        counterpartyName: "Inmuebles Gran Via SL",
        counterpartyTaxId: "B76543210",
        counterpartyCountryCode: "ES",
        companyTaxId: "B11223344",
        reviewStatus: "ready",
        reviewReasons: [],
        vatPeriodAssignment: golden.document.header.vat_period_assignment,
        withholdingPeriodAssignment: golden.document.header.withholding_period_assignment,
        observedAmountCents: 0,
        totalNetCents: 100000,
        totalVatCents: 21000,
        totalWithholdingCents: 19000,
        totalGrossCents: 121000,
        totalPayableCents: 102000,
        sourceConfidence: "manual",
        notes: null,
        lines: {
          deleteMany: {},
          createMany: {
            data: [
              {
                id: "fd_q1_002_l1",
                lineNumber: 1,
                concept: "Renta mensual del local",
                baseAmountCents: 100000,
                vatTreatment: "taxable",
                vatRateBps: 2100,
                vatAmountCents: 21000,
                withholdingApplicable: true,
                withholdingRegime: "rent",
                withholdingBaseCents: 100000,
                withholdingRateBps: 1900,
                withholdingAmountCents: 19000,
                deductibilityPercentBps: 10000,
                deductibilityReason: "fully_deductible",
                expenseFamily: "rent",
                isReadyForVatBooks: true,
                isReadyForWithholdingBooks: true,
              },
            ],
          },
        },
      },
      create: {
        id: "fd_q1_002",
        ownerScopeId: "fp_1",
        sourceTransactionId: "tx_q1_002",
        counterpartyId: "cp_inmuebles_gran_via_sl",
        documentKind: "received_invoice",
        direction: "incoming",
        invoiceNumber: "ALQ-2026-02",
        invoiceSeries: null,
        issueDate: new Date("2026-02-01T00:00:00.000Z"),
        operationDate: null,
        paymentDate: null,
        currencyCode: "EUR",
        counterpartyRole: "landlord",
        counterpartyName: "Inmuebles Gran Via SL",
        counterpartyTaxId: "B76543210",
        counterpartyCountryCode: "ES",
        companyTaxId: "B11223344",
        reviewStatus: "ready",
        reviewReasons: [],
        vatPeriodAssignment: golden.document.header.vat_period_assignment,
        withholdingPeriodAssignment: golden.document.header.withholding_period_assignment,
        observedAmountCents: 0,
        totalNetCents: 100000,
        totalVatCents: 21000,
        totalWithholdingCents: 19000,
        totalGrossCents: 121000,
        totalPayableCents: 102000,
        sourceConfidence: "manual",
        notes: null,
        lines: {
          create: [
            {
              id: "fd_q1_002_l1",
              lineNumber: 1,
              concept: "Renta mensual del local",
              baseAmountCents: 100000,
              vatTreatment: "taxable",
              vatRateBps: 2100,
              vatAmountCents: 21000,
              withholdingApplicable: true,
              withholdingRegime: "rent",
              withholdingBaseCents: 100000,
              withholdingRateBps: 1900,
              withholdingAmountCents: 19000,
              deductibilityPercentBps: 10000,
              deductibilityReason: "fully_deductible",
              expenseFamily: "rent",
              isReadyForVatBooks: true,
              isReadyForWithholdingBooks: true,
            },
          ],
        },
      },
      include: {
        lines: {
          orderBy: { lineNumber: "asc" },
        },
      },
    },
  ])
})

test("getTransactionFiscalById lee el documento con lineas ordenadas", async () => {
  const document = await getTransactionFiscalById("fd_q1_001", "fp_1", {
    transactionFiscal: {
      findFirst: async (args) => {
        assert.deepEqual(args, {
          where: {
            id: "fd_q1_001",
            ownerScopeId: "fp_1",
          },
          include: {
            lines: {
              orderBy: { lineNumber: "asc" },
            },
          },
        })

        return {
          id: "fd_q1_001",
          ownerScopeId: "fp_1",
          sourceTransactionId: "tx_q1_001",
          documentKind: "received_invoice",
          direction: "incoming",
          invoiceNumber: "REC-2026-001",
          invoiceSeries: null,
          issueDate: new Date("2026-01-15T00:00:00.000Z"),
          operationDate: null,
          paymentDate: null,
          currencyCode: "EUR",
          counterpartyId: "cp_papeleria_centro_sl",
          counterpartyRole: "supplier",
          counterpartyName: "Papeleria Centro SL",
          counterpartyTaxId: "B12345678",
          counterpartyCountryCode: "ES",
          companyTaxId: "B11223344",
          reviewStatus: "ready",
          reviewReasons: [],
          vatPeriodAssignment: {
            fiscal_year: 2026,
            quarter: 1,
            period_key: "2026-Q1",
            basis: "issue_date",
            assigned_at: "2026-03-21T09:00:00Z",
          },
          withholdingPeriodAssignment: null,
          observedAmountCents: 0,
          totalNetCents: 10000,
          totalVatCents: 2100,
          totalWithholdingCents: 0,
          totalGrossCents: 12100,
          totalPayableCents: 12100,
          sourceConfidence: "manual",
          notes: null,
          createdAt: new Date("2026-03-21T09:00:00.000Z"),
          updatedAt: new Date("2026-03-21T09:00:00.000Z"),
          lines: [
            {
              id: "fd_q1_001_l1",
              transactionFiscalId: "fd_q1_001",
              lineNumber: 1,
              concept: "Material de oficina",
              baseAmountCents: 10000,
              vatTreatment: "taxable",
              vatRateBps: 2100,
              vatAmountCents: 2100,
              withholdingApplicable: false,
              withholdingRegime: "none",
              withholdingBaseCents: 0,
              withholdingRateBps: 0,
              withholdingAmountCents: 0,
              deductibilityPercentBps: 10000,
              deductibilityReason: "fully_deductible",
              expenseFamily: "supplies",
              isReadyForVatBooks: true,
              isReadyForWithholdingBooks: false,
              createdAt: new Date("2026-03-21T09:00:00.000Z"),
              updatedAt: new Date("2026-03-21T09:00:00.000Z"),
            },
          ],
        }
      },
      findUnique: async () => null,
      upsert: async () => {
        throw new Error("no deberia escribir en una lectura")
      },
    },
  })

  assert.equal(document?.header.fiscal_document_id, "fd_q1_001")
  assert.equal(document?.lines.length, 1)
  assert.equal(document?.lines[0]?.line_id, "fd_q1_001_l1")
  assert.equal(document?.lines[0]?.is_ready_for_vat_books, true)
})

test("getTransactionFiscalBySourceTransactionId devuelve null si no existe el fact fiscal", async () => {
  const document = await getTransactionFiscalBySourceTransactionId("tx_missing", "fp_1", {
    transactionFiscal: {
      findFirst: async () => null,
      findUnique: async () => null,
      upsert: async () => {
        throw new Error("no deberia escribir en una lectura")
      },
    },
  })

  assert.equal(document, null)
})

test("listTransactionFiscalDocuments devuelve facts completos ordenados por fecha e id", async () => {
  const officeSupplies = getGoldenDocument("received-office-supplies").document
  const rent = getGoldenDocument("received-rent-withholding").document

  const documents = await listTransactionFiscalDocuments("fp_1", {
    transactionFiscal: {
      findMany: async (args) => {
        assert.deepEqual(args, {
          where: {
            ownerScopeId: "fp_1",
          },
          include: {
            lines: {
              orderBy: { lineNumber: "asc" },
            },
          },
          orderBy: [{ issueDate: "asc" }, { id: "asc" }],
        })

        return [
          createStoredTransactionFiscalRecord(rent),
          createStoredTransactionFiscalRecord(officeSupplies),
        ]
      },
    },
  })

  assert.deepEqual(
    documents.map((document) => document.header.fiscal_document_id),
    ["fd_q1_001", "fd_q1_002"]
  )
  assert.equal(documents[0]?.lines[0]?.line_number, 1)
  assert.equal(documents[1]?.header.invoice_number, "ALQ-2026-02")
})

test("upsertTransactionFiscal persiste blocked cuando una factura emitida trae deducibilidad invalida", async () => {
  const golden = getGoldenDocument("issued-services-invoice")
  const writes = []

  const document = await upsertTransactionFiscal("fp_1", {
    header: golden.document.header,
    lines: golden.document.lines.map((line) => ({
      ...line,
      deductibility_percent_bps: 10000,
      deductibility_reason: "fully_deductible",
    })),
  }, {
    transactionFiscal: {
      findFirst: async () => null,
      upsert: async (args) => {
        writes.push(args)

        return {
          id: "fd_q1_003",
          ownerScopeId: "fp_1",
          sourceTransactionId: "tx_q1_003",
          documentKind: "issued_invoice",
          direction: "outgoing",
          invoiceNumber: "VEN-2026-007",
          invoiceSeries: "VEN",
          issueDate: new Date("2026-03-10T00:00:00.000Z"),
          operationDate: null,
          paymentDate: null,
          currencyCode: "EUR",
          counterpartyId: "cp_cliente_demo_sl",
          counterpartyRole: "customer",
          counterpartyName: "Cliente Demo SL",
          counterpartyTaxId: "B99887766",
          counterpartyCountryCode: "ES",
          companyTaxId: "B11223344",
          reviewStatus: "blocked",
          reviewReasons: ["manual_override_required"],
          vatPeriodAssignment: golden.document.header.vat_period_assignment,
          withholdingPeriodAssignment: null,
          observedAmountCents: 0,
          totalNetCents: 200000,
          totalVatCents: 42000,
          totalWithholdingCents: 0,
          totalGrossCents: 242000,
          totalPayableCents: 242000,
          sourceConfidence: "manual",
          notes: null,
          createdAt: new Date("2026-03-21T09:00:00.000Z"),
          updatedAt: new Date("2026-03-21T09:00:00.000Z"),
          lines: [
            {
              id: "fd_q1_003_l1",
              transactionFiscalId: "fd_q1_003",
              lineNumber: 1,
              concept: "Servicios profesionales",
              baseAmountCents: 200000,
              vatTreatment: "taxable",
              vatRateBps: 2100,
              vatAmountCents: 42000,
              withholdingApplicable: false,
              withholdingRegime: "none",
              withholdingBaseCents: 0,
              withholdingRateBps: 0,
              withholdingAmountCents: 0,
              deductibilityPercentBps: 10000,
              deductibilityReason: "fully_deductible",
              expenseFamily: "services",
              isReadyForVatBooks: false,
              isReadyForWithholdingBooks: false,
              createdAt: new Date("2026-03-21T09:00:00.000Z"),
              updatedAt: new Date("2026-03-21T09:00:00.000Z"),
            },
          ],
        }
      },
    },
  })

  assert.equal(writes[0]?.update.reviewStatus, "blocked")
  assert.deepEqual(writes[0]?.update.reviewReasons, ["manual_override_required"])
  assert.equal(writes[0]?.update.lines.createMany.data[0]?.isReadyForVatBooks, false)
  assert.equal(document.header.review_status, "blocked")
  assert.deepEqual(document.header.review_reasons, ["manual_override_required"])
})

test("upsertTransactionFiscal autoasigna payment_date y persiste basis/assigned_at cuando aplica criterio de caja", async () => {
  const writes = []

  const document = await upsertTransactionFiscal(
    "fp_1",
    {
      header: {
        fiscal_document_id: "fd_cash_1",
        source_transaction_id: "tx_cash_1",
        document_kind: "received_invoice",
        direction: "incoming",
        invoice_number: "ALQ-2026-04",
        issue_date: "2026-03-25",
        operation_date: "2026-03-25",
        payment_date: "2026-04-05",
        currency_code: "EUR",
        counterparty_id: "cp_landlord_1",
        counterparty_role: "landlord",
        counterparty_name: "Arrendador Demo SL",
        counterparty_tax_id: "B76543210",
        counterparty_country_code: "ES",
        company_tax_id: "B11223344",
        total_net_cents: 100000,
        total_vat_cents: 21000,
        total_withholding_cents: 19000,
        total_gross_cents: 121000,
        total_payable_cents: 102000,
      },
      lines: [
        {
          line_id: "fd_cash_1_l1",
          line_number: 1,
          concept: "Renta mensual",
          base_amount_cents: 100000,
          vat_treatment: "taxable",
          vat_rate_bps: 2100,
          vat_amount_cents: 21000,
          withholding_applicable: true,
          withholding_regime: "rent",
          withholding_base_cents: 100000,
          withholding_rate_bps: 1900,
          withholding_amount_cents: 19000,
          deductibility_percent_bps: 10000,
          deductibility_reason: "fully_deductible",
          expense_family: "rent",
        },
      ],
    },
    {
      transactionFiscal: {
        findFirst: async () => null,
        upsert: async (args) => {
          writes.push(args)

          return {
            id: "fd_cash_1",
            ownerScopeId: "fp_1",
            sourceTransactionId: "tx_cash_1",
            documentKind: "received_invoice",
            direction: "incoming",
            invoiceNumber: "ALQ-2026-04",
            invoiceSeries: null,
            issueDate: new Date("2026-03-25T00:00:00.000Z"),
            operationDate: new Date("2026-03-25T00:00:00.000Z"),
            paymentDate: new Date("2026-04-05T00:00:00.000Z"),
            currencyCode: "EUR",
            counterpartyId: "cp_landlord_1",
            counterpartyRole: "landlord",
            counterpartyName: "Arrendador Demo SL",
            counterpartyTaxId: "B76543210",
            counterpartyCountryCode: "ES",
            companyTaxId: "B11223344",
            reviewStatus: "ready",
            reviewReasons: [],
            vatPeriodAssignment: {
              fiscal_year: 2026,
              quarter: 2,
              period_key: "2026-Q2",
              basis: "payment_date",
              assigned_at: "2026-03-22T10:00:00Z",
            },
            withholdingPeriodAssignment: {
              fiscal_year: 2026,
              quarter: 2,
              period_key: "2026-Q2",
              basis: "payment_date",
              assigned_at: "2026-03-22T10:00:00Z",
            },
            observedAmountCents: 0,
            totalNetCents: 100000,
            totalVatCents: 21000,
            totalWithholdingCents: 19000,
            totalGrossCents: 121000,
            totalPayableCents: 102000,
            sourceConfidence: "manual",
            notes: null,
            createdAt: new Date("2026-03-22T10:00:00.000Z"),
            updatedAt: new Date("2026-03-22T10:00:00.000Z"),
            lines: [
              {
                id: "fd_cash_1_l1",
                transactionFiscalId: "fd_cash_1",
                lineNumber: 1,
                concept: "Renta mensual",
                baseAmountCents: 100000,
                vatTreatment: "taxable",
                vatRateBps: 2100,
                vatAmountCents: 21000,
                withholdingApplicable: true,
                withholdingRegime: "rent",
                withholdingBaseCents: 100000,
                withholdingRateBps: 1900,
                withholdingAmountCents: 19000,
                deductibilityPercentBps: 10000,
                deductibilityReason: "fully_deductible",
                expenseFamily: "rent",
                isReadyForVatBooks: true,
                isReadyForWithholdingBooks: true,
                createdAt: new Date("2026-03-22T10:00:00.000Z"),
                updatedAt: new Date("2026-03-22T10:00:00.000Z"),
              },
            ],
          }
        },
      },
    },
    {
      vatCashAccountingEnabled: true,
      assignedAt: "2026-03-22T10:00:00Z",
    }
  )

  assert.deepEqual(writes[0]?.update.paymentDate, new Date("2026-04-05T00:00:00.000Z"))
  assert.deepEqual(writes[0]?.update.vatPeriodAssignment, {
    fiscal_year: 2026,
    quarter: 2,
    period_key: "2026-Q2",
    basis: "payment_date",
    assigned_at: "2026-03-22T10:00:00Z",
  })
  assert.deepEqual(writes[0]?.update.withholdingPeriodAssignment, {
    fiscal_year: 2026,
    quarter: 2,
    period_key: "2026-Q2",
    basis: "payment_date",
    assigned_at: "2026-03-22T10:00:00Z",
  })
  assert.equal(document.header.payment_date, "2026-04-05")
  assert.equal(document.header.review_status, "ready")
})

test("upsertTransactionFiscal mantiene el IVA listo cuando solo falta payment_date para retenciones", async () => {
  const writes = []
  const golden = getGoldenDocument("received-rent-withholding")

  const document = await upsertTransactionFiscal(
    "fp_1",
    {
      header: {
        ...golden.document.header,
        withholding_period_assignment: null,
        payment_date: null,
      },
      lines: golden.document.lines,
    },
    {
      transactionFiscal: {
        findFirst: async () => null,
        upsert: async (args) => {
          writes.push(args)

          return {
            id: "fd_q1_002",
            ownerScopeId: "fp_1",
            sourceTransactionId: "tx_q1_002",
            documentKind: "received_invoice",
            direction: "incoming",
            invoiceNumber: "ALQ-2026-02",
            invoiceSeries: null,
            issueDate: new Date("2026-02-01T00:00:00.000Z"),
            operationDate: null,
            paymentDate: null,
            currencyCode: "EUR",
            counterpartyId: "cp_landlord_1",
            counterpartyRole: "landlord",
            counterpartyName: "Inmuebles Gran Via SL",
            counterpartyTaxId: "B76543210",
            counterpartyCountryCode: "ES",
            companyTaxId: "B11223344",
            reviewStatus: "blocked",
            reviewReasons: ["manual_override_required"],
            vatPeriodAssignment: {
              fiscal_year: 2026,
              quarter: 1,
              period_key: "2026-Q1",
              basis: "issue_date",
              assigned_at: "2026-03-21T09:00:00Z",
            },
            withholdingPeriodAssignment: null,
            observedAmountCents: 0,
            totalNetCents: 100000,
            totalVatCents: 21000,
            totalWithholdingCents: 19000,
            totalGrossCents: 121000,
            totalPayableCents: 102000,
            sourceConfidence: "manual",
            notes: null,
            createdAt: new Date("2026-03-22T10:00:00.000Z"),
            updatedAt: new Date("2026-03-22T10:00:00.000Z"),
            lines: [
              {
                id: "fd_q1_002_l1",
                transactionFiscalId: "fd_q1_002",
                lineNumber: 1,
                concept: "Renta mensual",
                baseAmountCents: 100000,
                vatTreatment: "taxable",
                vatRateBps: 2100,
                vatAmountCents: 21000,
                withholdingApplicable: true,
                withholdingRegime: "rent",
                withholdingBaseCents: 100000,
                withholdingRateBps: 1900,
                withholdingAmountCents: 19000,
                deductibilityPercentBps: 10000,
                deductibilityReason: "fully_deductible",
                expenseFamily: "rent",
                isReadyForVatBooks: true,
                isReadyForWithholdingBooks: false,
                createdAt: new Date("2026-03-22T10:00:00.000Z"),
                updatedAt: new Date("2026-03-22T10:00:00.000Z"),
              },
            ],
          }
        },
      },
    }
  )

  assert.equal(writes[0]?.update.reviewStatus, "blocked")
  assert.deepEqual(writes[0]?.update.reviewReasons, ["manual_override_required"])
  assert.deepEqual(writes[0]?.update.vatPeriodAssignment, {
    fiscal_year: 2026,
    quarter: 1,
    period_key: "2026-Q1",
    basis: "issue_date",
    assigned_at: "2026-03-21T09:00:00Z",
  })
  assert.equal(writes[0]?.update.withholdingPeriodAssignment, null)
  assert.equal(writes[0]?.update.lines.createMany.data[0]?.isReadyForVatBooks, true)
  assert.equal(writes[0]?.update.lines.createMany.data[0]?.isReadyForWithholdingBooks, false)
  assert.equal(document.header.review_status, "blocked")
  assert.deepEqual(document.header.review_reasons, ["manual_override_required"])
})

test("upsertTransactionFiscal falla si intentan cambiar el fiscal_document_id estable de un source_transaction_id existente", async () => {
  const golden = getGoldenDocument("received-office-supplies")

  await assert.rejects(
    upsertTransactionFiscal("fp_1", {
      header: {
        ...golden.document.header,
        fiscal_document_id: "fd_reemplazado",
      },
      lines: golden.document.lines.map((line) => ({
        ...line,
        line_id: "fd_reemplazado_l1",
        fiscal_document_id: "fd_reemplazado",
      })),
    }, {
      transactionFiscal: {
        findFirst: async (args) => {
          assert.deepEqual(args, {
            where: {
              ownerScopeId: "fp_1",
              sourceTransactionId: "tx_q1_001",
            },
            include: {
              lines: {
                orderBy: {
                  lineNumber: "asc",
                },
              },
            },
          })

          return createStoredTransactionFiscalRecord(golden.document)
        },
        upsert: async () => {
          throw new Error("no deberia intentar mutar la PK estable")
        },
      },
    }),
    /fiscal_document_id estable/
  )
})

test("upsertTransactionFiscal bloquea una mutacion fiscal sensible cuando el periodo actual ya esta cerrado", async () => {
  const golden = getGoldenDocument("received-office-supplies")
  const nextDocument = cloneFiscalDocument(golden.document, {
    header: {
      vat_period_assignment: {
        fiscal_year: 2026,
        quarter: 2,
        period_key: "2026-Q2",
        basis: "manual_override",
        assigned_at: "2026-04-02T09:00:00.000Z",
      },
    },
  })
  const guarded = createGuardedTransactionFiscalStore({
    existingDocument: golden.document,
    periodStatuses: {
      "2026-Q1": "closed",
      "2026-Q2": "open",
    },
  })

  await assert.rejects(
    upsertTransactionFiscal("fp_1", nextDocument, guarded.store, {
      auditActor: {
        type: "user",
        id: "user_1",
      },
      occurredAt: "2026-04-02T09:00:00.000Z",
    }),
    /periodos cerrados o presentados/
  )

  assert.equal(guarded.writes.length, 0)
  assert.equal(guarded.auditEvents.length, 1)
  assert.equal(guarded.auditEvents[0]?.event, FISCAL_AUDIT_EVENT_FISCAL_DOCUMENT_EDIT_BLOCKED)
  assert.equal(guarded.auditEvents[0]?.fiscalDocumentId, golden.document.header.fiscal_document_id)
  assert.match(String(guarded.auditEvents[0]?.payload.reason ?? ""), /2026-Q1/)
})

test("upsertTransactionFiscal registra fiscal_document_edited cuando la mutacion sensible esta permitida", async () => {
  const golden = getGoldenDocument("received-office-supplies")
  const nextDocument = cloneFiscalDocument(golden.document, {
    header: {
      vat_period_assignment: {
        fiscal_year: 2026,
        quarter: 2,
        period_key: "2026-Q2",
        basis: "manual_override",
        assigned_at: "2026-04-03T10:00:00.000Z",
      },
    },
  })
  const persistedDocument = cloneFiscalDocument(nextDocument, {
    header: {
      review_status: "ready",
      review_reasons: [],
    },
  })
  const guarded = createGuardedTransactionFiscalStore({
    existingDocument: golden.document,
    persistedDocument,
    periodStatuses: {
      "2026-Q1": "in_review",
      "2026-Q2": "open",
    },
  })

  const document = await upsertTransactionFiscal("fp_1", nextDocument, guarded.store, {
    auditActor: {
      type: "user",
      id: "user_2",
    },
    auditReason: "Reclasificacion manual del IVA",
    occurredAt: "2026-04-03T10:00:00.000Z",
  })

  assert.equal(guarded.writes.length, 1)
  assert.equal(guarded.auditEvents.length, 1)
  assert.equal(guarded.auditEvents[0]?.event, FISCAL_AUDIT_EVENT_FISCAL_DOCUMENT_EDITED)
  assert.equal(guarded.auditEvents[0]?.fiscalDocumentId, golden.document.header.fiscal_document_id)
  assert.equal(guarded.auditEvents[0]?.payload.reason, "Reclasificacion manual del IVA")
  assert.equal(document.header.vat_period_assignment?.period_key, "2026-Q2")
})
