import assert from "node:assert/strict"
import test from "node:test"

import { listLegalArchivePeriods } from "../../../models/fiscal/legal-archive.ts"
import { ensureFiscalDocumentsSynced } from "../../../models/fiscal/sync.ts"

function createTransaction(overrides = {}) {
  return {
    id: "tx_scope_1",
    userId: "user_1",
    name: "Servicio mensual",
    description: null,
    merchant: "Proveedor Demo SL",
    total: 121000,
    currencyCode: "EUR",
    type: "expense",
    extra: {
      invoice_number: "REC-2026-001",
    },
    issuedAt: new Date("2026-03-10T00:00:00.000Z"),
    createdAt: new Date("2026-03-11T09:00:00.000Z"),
    updatedAt: new Date("2026-03-11T09:00:00.000Z"),
    ...overrides,
  }
}

test("ensureFiscalDocumentsSynced usa organizationId como raíz cuando se le pasa explícitamente", async () => {
  let organizationScopedLookup = 0
  let userScopedLookup = 0

  const result = await ensureFiscalDocumentsSynced("user_1", {
    organizationId: "org_1",
    transactions: [createTransaction()],
    dependencies: {
      getFiscalProfileAccessByOrganizationId: async (organizationId, userId) => {
        organizationScopedLookup += 1
        assert.equal(organizationId, "org_1")
        assert.equal(userId, "user_1")

        return {
          status: "profile_missing",
          profile: null,
        }
      },
      getFiscalProfileAccessByUserId: async () => {
        userScopedLookup += 1
        return {
          status: "ready",
          profile: {
            id: "fp_wrong",
          },
        }
      },
    },
  })

  assert.equal(result.accessStatus, "profile_missing")
  assert.equal(organizationScopedLookup, 1)
  assert.equal(userScopedLookup, 0)
})

test("listLegalArchivePeriods filtra adjuntos y transacciones por organizationId", async () => {
  let capturedTransactionWhere = null
  let capturedFileWhere = null

  await listLegalArchivePeriods("fp_demo", "org_demo", {
    fiscalPeriod: {
      findMany: async () => [
        {
          id: "period_2026_q1",
          ownerScopeId: "fp_demo",
          fiscalYear: 2026,
          quarter: 1,
          periodKey: "2026-Q1",
          startsOn: new Date("2026-01-01T00:00:00.000Z"),
          endsOn: new Date("2026-03-31T00:00:00.000Z"),
          status: "open",
          countryCode: "ES",
          currencyCode: "EUR",
          createdAt: new Date("2026-03-21T09:00:00.000Z"),
          updatedAt: new Date("2026-03-21T09:00:00.000Z"),
        },
      ],
    },
    transactionFiscal: {
      findMany: async () => [
        {
          id: "fd_legal_1",
          sourceTransactionId: "tx_legal_1",
          documentKind: "received_invoice",
          direction: "inbound",
          invoiceNumber: "REC-2026-001",
          invoiceSeries: null,
          issueDate: new Date("2026-02-01T00:00:00.000Z"),
          operationDate: null,
          paymentDate: null,
          currencyCode: "EUR",
          counterpartyId: null,
          counterpartyRole: "supplier",
          counterpartyName: "Proveedor Demo SL",
          counterpartyTaxId: null,
          counterpartyCountryCode: "ES",
          companyTaxId: "B12345678",
          reviewStatus: "ready",
          reviewReasons: [],
          vatPeriodAssignment: { period_key: "2026-Q1" },
          withholdingPeriodAssignment: null,
          observedAmountCents: 1000,
          totalNetCents: 1000,
          totalVatCents: 210,
          totalWithholdingCents: 0,
          totalGrossCents: 1210,
          totalPayableCents: 1210,
          sourceConfidence: "high",
          notes: null,
          lines: [],
        },
      ],
    },
    transaction: {
      findMany: async ({ where }) => {
        capturedTransactionWhere = where
        return [{ id: "tx_legal_1", organizationId: "org_demo", files: ["file_legal_1"] }]
      },
    },
    file: {
      findMany: async ({ where }) => {
        capturedFileWhere = where
        return [
          {
            id: "file_legal_1",
            organizationId: "org_demo",
            filename: "factura.pdf",
            mimetype: "application/pdf",
            metadata: { size: 1024 },
            createdAt: new Date("2026-03-21T09:00:00.000Z"),
          },
        ]
      },
    },
  })

  assert.deepEqual(capturedTransactionWhere, {
    organizationId: "org_demo",
    id: {
      in: ["tx_legal_1"],
    },
  })
  assert.deepEqual(capturedFileWhere, {
    organizationId: "org_demo",
    id: {
      in: ["file_legal_1"],
    },
  })
})
