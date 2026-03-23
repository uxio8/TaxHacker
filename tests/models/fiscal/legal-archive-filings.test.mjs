import assert from "node:assert/strict"
import test from "node:test"

import { getLegalArchivePeriodDetail } from "../../../models/fiscal/legal-archive.ts"

test("getLegalArchivePeriodDetail integra expedientes de presentacion por obligacion fiscal del periodo", async () => {
  let capturedObligationWhere = null
  let capturedReceiptWhere = null

  const detail = await getLegalArchivePeriodDetail("fp_demo", "org_demo", "2026-Q1", {
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
      findUnique: async () => null,
    },
    transactionFiscal: {
      findMany: async () => [],
    },
    transaction: {
      findMany: async () => [],
    },
    file: {
      findMany: async (args) => {
        capturedReceiptWhere = args.where

        return [
          {
            id: "file_receipt_303",
            filename: "303-q1-justificante.pdf",
            mimetype: "application/pdf",
            metadata: { size: 4096 },
            createdAt: new Date("2026-04-20T09:00:00.000Z"),
          },
        ]
      },
    },
    fiscalObligation: {
      findMany: async (args) => {
        capturedObligationWhere = args.where

        return [
          {
            id: "obl_303_q1",
            code: "303",
            periodKey: "2026-Q1",
            status: "ready_to_file",
            dueDate: new Date("2026-04-20T00:00:00.000Z"),
            owner: "advisor",
            requiredEvidence: ["source_documents", "vat_breakdown", "filing_receipt"],
          },
          {
            id: "obl_115_q1",
            code: "115",
            periodKey: "2026-Q1",
            status: "waiting_on_documents",
            dueDate: new Date("2026-04-20T00:00:00.000Z"),
            owner: "advisor",
            requiredEvidence: [
              "source_documents",
              "counterparty_tax_id",
              "rent_contract",
              "filing_receipt",
            ],
          },
        ]
      },
    },
    fiscalFilingDossier: {
      findUnique: async ({ where }) => {
        if (where.fiscalObligationId === "obl_303_q1") {
          return {
            id: "dossier_303_q1",
            fiscalObligationId: "obl_303_q1",
            draftSnapshot: {
              obligationCode: "303",
              totals: { resultVatPayableCents: 4200 },
            },
            evidenceManifest: {
              attached: ["source_documents"],
            },
            checklistState: {
              draftReady: true,
            },
            filingReference: "CSV-2026-0001",
            filedAt: new Date("2026-04-20T09:00:00.000Z"),
            filedByUserId: "user_1",
            filingReceiptFileId: "file_receipt_303",
            filingNotes: "Presentado externamente",
            createdAt: new Date("2026-04-20T09:00:00.000Z"),
            updatedAt: new Date("2026-04-20T09:00:00.000Z"),
          }
        }

        return null
      },
    },
  })

  assert.ok(detail)
  assert.deepEqual(capturedObligationWhere, {
    organizationId: "org_demo",
    periodKey: "2026-Q1",
  })
  assert.deepEqual(capturedReceiptWhere, {
    organizationId: "org_demo",
    id: {
      in: ["file_receipt_303"],
    },
  })
  assert.deepEqual(
    detail.manifest.filings.map((filing) => ({
      obligationId: filing.obligationId,
      code: filing.code,
      status: filing.status,
      hasDraftSnapshot: filing.hasDraftSnapshot,
      filingReference: filing.filingReference,
      hasReceipt: filing.filingReceipt !== null,
      attachedEvidenceCount: filing.attachedEvidence.length,
      missingEvidence: filing.missingEvidence,
    })),
    [
      {
        obligationId: "obl_115_q1",
        code: "115",
        status: "waiting_on_documents",
        hasDraftSnapshot: false,
        filingReference: null,
        hasReceipt: false,
        attachedEvidenceCount: 0,
        missingEvidence: [
          "counterparty_tax_id",
          "filing_receipt",
          "rent_contract",
          "source_documents",
        ],
      },
      {
        obligationId: "obl_303_q1",
        code: "303",
        status: "ready_to_file",
        hasDraftSnapshot: true,
        filingReference: "CSV-2026-0001",
        hasReceipt: true,
        attachedEvidenceCount: 2,
        missingEvidence: ["vat_breakdown"],
      },
    ]
  )
})
