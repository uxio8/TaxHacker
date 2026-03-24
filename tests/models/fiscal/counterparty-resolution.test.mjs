import assert from "node:assert/strict"
import test from "node:test"

import {
  COUNTERPARTY_CONFLICT_REASON,
  COUNTERPARTY_RESOLUTION_DECISION,
  COUNTERPARTY_RESOLUTION_RULE_VERSION,
  getCounterpartyResolutionQualityStatus,
  getCounterpartyResolutionMaterialityBucket,
  resolveCounterpartyResolution,
} from "../../../models/fiscal/counterparty-resolution.ts"

function createCounterparty(overrides = {}) {
  return {
    id: "cp_1",
    displayName: "Suministros Luz Centro SA",
    normalizedName: "SUMINISTROS LUZ CENTRO SA",
    taxId: "A55667788",
    taxIdNormalized: "A55667788",
    canonicalIdentityKey: "ES:NIF:A55667788",
    isActive: true,
    ...overrides,
  }
}

function createDocument(overrides = {}) {
  return {
    fiscal_document_id: "fd_q1_008",
    source_transaction_id: "tx_q1_008",
    document_kind: "received_invoice",
    counterparty_id: null,
    counterparty_name: "Suministros Luz Centro SA",
    counterparty_tax_id: "A55667788",
    counterparty_role: "supplier",
    issue_date: "2026-03-22",
    total_payable_cents: 30250,
    total_vat_cents: 5250,
    total_withholding_cents: 0,
    ...overrides,
  }
}

function resolve(documentOverrides = {}, counterparties = [createCounterparty()]) {
  return resolveCounterpartyResolution({
    ownerScopeId: "fp_1",
    document: createDocument(documentOverrides),
    counterparties,
  })
}

test("resolveCounterpartyResolution auto-vincula por NIF exacto unico y activo", () => {
  const result = resolve()

  assert.equal(result.rule_version, COUNTERPARTY_RESOLUTION_RULE_VERSION)
  assert.equal(result.decision, COUNTERPARTY_RESOLUTION_DECISION.AUTO_LINKED)
  assert.equal(result.linked_counterparty_id, "cp_1")
  assert.equal(result.materiality_bucket, "medium")
  assert.equal(result.evidence.match_basis, "tax_id")
  assert.equal(result.evidence.conflict_reason, null)
  assert.equal(result.relevant_candidates.length, 1)
})

test("resolveCounterpartyResolution no auto-vincula si hay duplicado por NIF", () => {
  const result = resolve({}, [
    createCounterparty({ id: "cp_1" }),
    createCounterparty({ id: "cp_2", displayName: "Suministros Luz Centro SA duplicado" }),
  ])

  assert.equal(
    result.decision,
    COUNTERPARTY_RESOLUTION_DECISION.NEEDS_REVIEW_NO_SAFE_CANDIDATE
  )
  assert.equal(result.linked_counterparty_id, null)
  assert.equal(
    result.evidence.conflict_reason,
    COUNTERPARTY_CONFLICT_REASON.MULTIPLE_TAX_ID_CANDIDATES
  )
})

test("resolveCounterpartyResolution no auto-vincula si la unica candidata por NIF esta inactiva", () => {
  const result = resolve({}, [createCounterparty({ isActive: false })])

  assert.equal(
    result.decision,
    COUNTERPARTY_RESOLUTION_DECISION.NEEDS_REVIEW_NO_SAFE_CANDIDATE
  )
  assert.equal(
    result.evidence.conflict_reason,
    COUNTERPARTY_CONFLICT_REASON.TAX_ID_MATCH_INACTIVE_ONLY
  )
})

test("resolveCounterpartyResolution sugiere por nombre cuando falta NIF", () => {
  const result = resolve(
    {
      counterparty_tax_id: null,
      counterparty_name: "Suministros Luz Centro SA",
    },
    [createCounterparty()]
  )

  assert.equal(
    result.decision,
    COUNTERPARTY_RESOLUTION_DECISION.SUGGESTED_REQUIRES_CONFIRMATION
  )
  assert.equal(result.linked_counterparty_id, null)
  assert.equal(result.evidence.match_basis, "name")
  assert.equal(result.evidence.conflict_reason, null)
  assert.equal(result.relevant_candidates[0]?.match_reasons[0], "name_exact")
})

test("resolveCounterpartyResolution mantiene review si no encuentra candidata segura", () => {
  const result = resolve(
    {
      counterparty_tax_id: null,
      counterparty_name: "Proveedor Desconocido SL",
    },
    []
  )

  assert.equal(
    result.decision,
    COUNTERPARTY_RESOLUTION_DECISION.NEEDS_REVIEW_NO_SAFE_CANDIDATE
  )
  assert.equal(result.linked_counterparty_id, null)
  assert.equal(result.evidence.conflict_reason, COUNTERPARTY_CONFLICT_REASON.NO_NAME_MATCH)
  assert.equal(result.relevant_candidates.length, 0)
})

test("getCounterpartyResolutionMaterialityBucket trata retencion como high aunque los importes sean bajos", () => {
  assert.equal(
    getCounterpartyResolutionMaterialityBucket({
      ...createDocument(),
      total_payable_cents: 9000,
      total_vat_cents: 0,
      total_withholding_cents: 1,
    }),
    "high"
  )
})

test("getCounterpartyResolutionQualityStatus solo trata como fiable el match automático por NIF", () => {
  assert.equal(
    getCounterpartyResolutionQualityStatus({
      decision: "auto_linked",
      evidence: {
        match_basis: "tax_id",
      },
    }),
    "reliable"
  )

  assert.equal(
    getCounterpartyResolutionQualityStatus({
      decision: "suggested_requires_confirmation",
      evidence: {
        match_basis: "name",
      },
    }),
    "needs_review"
  )
})
