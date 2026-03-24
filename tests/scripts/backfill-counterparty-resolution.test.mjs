import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { runCounterpartyResolutionBackfill } from "../../scripts/backfill-counterparty-resolution.ts"

function loadGoldenQuarter() {
  return JSON.parse(
    readFileSync(new URL("../fixtures/fiscal/golden-quarter.json", import.meta.url), "utf8")
  )
}

function getGoldenDocument(caseId) {
  const document = loadGoldenQuarter().documents.find((entry) => entry.case_id === caseId)

  assert.ok(document, `No existe el caso ${caseId} en el golden quarter`)
  return structuredClone(document.document)
}

function buildCounterparty(overrides = {}) {
  return {
    id: "cp_supply_1",
    ownerScopeId: "fp_1",
    displayName: "Suministros Luz Centro SA",
    normalizedName: "SUMINISTROS LUZ CENTRO SA",
    taxId: "A55667788",
    taxIdNormalized: "A55667788",
    canonicalIdentityKey: "ES:NIF:A55667788",
    isActive: true,
    ...overrides,
  }
}

test("runCounterpartyResolutionBackfill resume dry-run sin escribir", async () => {
  const autoLinkedDocument = getGoldenDocument("received-missing-counterparty-relation")
  const conflictingDocument = getGoldenDocument("received-office-supplies")
  conflictingDocument.header.fiscal_document_id = "fd_conflict_1"
  conflictingDocument.header.source_transaction_id = "tx_conflict_1"
  conflictingDocument.header.counterparty_id = null
  conflictingDocument.header.counterparty_name = "Proveedor sin match"
  conflictingDocument.header.counterparty_tax_id = "B99999999"

  let applyCalls = 0

  const report = await runCounterpartyResolutionBackfill(
    {
      ownerScopeId: "fp_1",
      dryRun: true,
    },
    {
      listDocuments: async () => [autoLinkedDocument, conflictingDocument],
      listCounterparties: async () => [buildCounterparty()],
      applyAutoLink: async () => {
        applyCalls += 1
      },
    }
  )

  assert.deepEqual(report, {
    ownerScopeId: "fp_1",
    scanned: 2,
    autoLinked: 1,
    stillInReview: 1,
    conflictsFound: 1,
    applied: 0,
    dryRun: true,
  })
  assert.equal(applyCalls, 0)
})

test("runCounterpartyResolutionBackfill aplica solo los auto-links cuando se pide apply", async () => {
  const autoLinkedDocument = getGoldenDocument("received-missing-counterparty-relation")
  const applied = []

  const report = await runCounterpartyResolutionBackfill(
    {
      ownerScopeId: "fp_1",
      apply: true,
    },
    {
      listDocuments: async () => [autoLinkedDocument],
      listCounterparties: async () => [buildCounterparty()],
      applyAutoLink: async (ownerScopeId, document, resolution) => {
        applied.push({
          ownerScopeId,
          fiscalDocumentId: document.header.fiscal_document_id,
          linkedCounterpartyId: resolution.linked_counterparty_id,
        })
      },
    }
  )

  assert.deepEqual(applied, [
    {
      ownerScopeId: "fp_1",
      fiscalDocumentId: "fd_q1_008",
      linkedCounterpartyId: "cp_supply_1",
    },
  ])
  assert.equal(report.applied, 1)
  assert.equal(report.dryRun, false)
})
