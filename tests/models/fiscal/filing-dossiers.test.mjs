import assert from "node:assert/strict"
import test from "node:test"

import {
  getFiscalFilingDossierByObligationId,
  upsertFiscalFilingDossier,
} from "../../../models/fiscal/filing-dossiers.ts"

test("upsertFiscalFilingDossier persiste el expediente idempotente por obligationId", async () => {
  const calls = []

  const dossier = await upsertFiscalFilingDossier(
    {
      fiscalObligationId: "obligation_303_q1",
      draftSnapshot: {
        obligationCode: "303",
        totals: {
          resultVatPayableCents: 4200,
        },
      },
      evidenceManifest: {
        required: ["source_documents", "vat_breakdown"],
        attached: ["file_receipt_1"],
      },
      checklistState: {
        draftReady: true,
        readyToFile: false,
      },
      filingReference: "CSV-2026-0001",
      filedAt: "2026-04-18T09:30:00.000Z",
      filedByUserId: "user_1",
      filingReceiptFileId: "file_1",
      filingNotes: "Presentado externamente y archivado en TaxHacker",
    },
    {
      fiscalFilingDossier: {
        upsert: async (args) => {
          calls.push(args)
          return {
            id: "dossier_1",
            fiscalObligationId: "obligation_303_q1",
            draftSnapshot: args.create.draftSnapshot,
            evidenceManifest: args.create.evidenceManifest,
            checklistState: args.create.checklistState,
            filingReference: args.create.filingReference,
            filedAt: args.create.filedAt,
            filedByUserId: args.create.filedByUserId,
            filingReceiptFileId: args.create.filingReceiptFileId,
            filingNotes: args.create.filingNotes,
            createdAt: new Date("2026-03-23T10:00:00.000Z"),
            updatedAt: new Date("2026-03-23T10:00:00.000Z"),
          }
        },
      },
    }
  )

  assert.equal(dossier.filingReference, "CSV-2026-0001")
  assert.equal(dossier.filedByUserId, "user_1")
  assert.equal(dossier.filingReceiptFileId, "file_1")
  assert.equal(dossier.filingNotes, "Presentado externamente y archivado en TaxHacker")
  assert.deepEqual(calls, [
    {
      where: {
        fiscalObligationId: "obligation_303_q1",
      },
      update: {
        draftSnapshot: {
          obligationCode: "303",
          totals: {
            resultVatPayableCents: 4200,
          },
        },
        evidenceManifest: {
          required: ["source_documents", "vat_breakdown"],
          attached: ["file_receipt_1"],
        },
        checklistState: {
          draftReady: true,
          readyToFile: false,
        },
        filingReference: "CSV-2026-0001",
        filedAt: new Date("2026-04-18T09:30:00.000Z"),
        filedByUserId: "user_1",
        filingReceiptFileId: "file_1",
        filingNotes: "Presentado externamente y archivado en TaxHacker",
      },
      create: {
        fiscalObligationId: "obligation_303_q1",
        draftSnapshot: {
          obligationCode: "303",
          totals: {
            resultVatPayableCents: 4200,
          },
        },
        evidenceManifest: {
          required: ["source_documents", "vat_breakdown"],
          attached: ["file_receipt_1"],
        },
        checklistState: {
          draftReady: true,
          readyToFile: false,
        },
        filingReference: "CSV-2026-0001",
        filedAt: new Date("2026-04-18T09:30:00.000Z"),
        filedByUserId: "user_1",
        filingReceiptFileId: "file_1",
        filingNotes: "Presentado externamente y archivado en TaxHacker",
      },
    },
  ])
})

test("getFiscalFilingDossierByObligationId devuelve null cuando no hay expediente", async () => {
  const dossier = await getFiscalFilingDossierByObligationId("missing", {
    fiscalFilingDossier: {
      findUnique: async (args) => {
        assert.deepEqual(args, {
          where: {
            fiscalObligationId: "missing",
          },
        })

        return null
      },
    },
  })

  assert.equal(dossier, null)
})
