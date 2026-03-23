import assert from "node:assert/strict"
import test from "node:test"

import { getModel347Gate } from "../../../models/tax-forms/model-347.ts"

function createProfile(overrides = {}) {
  return {
    id: "fp_demo",
    organizationId: "org_demo",
    hasEmployees: false,
    hasRentWithholding: false,
    hasProfessionalWithholding: false,
    hasIntraEuOperations: false,
    issuesInvoices: true,
    annualCloseMonth: 12,
    ...overrides,
  }
}

function createCounterparty(overrides = {}) {
  return {
    id: "cp_demo",
    ownerScopeId: "fp_demo",
    displayName: "Proveedor Demo SL",
    taxId: "B12345678",
    taxIdNormalized: "B12345678",
    countryCode: "ES",
    canonicalIdentityKey: "ES:NIF:B12345678",
    normalizedName: "PROVEEDOR DEMO SL",
    identityBasis: "tax_id",
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  }
}

test("getModel347Gate habilita el modelo cuando el tenant tiene terceros activos con NIF fiable", () => {
  const gate = getModel347Gate({
    fiscalYear: 2025,
    profile: createProfile(),
    counterparties: [createCounterparty()],
  })

  assert.equal(gate.obligationCode, "347")
  assert.equal(gate.fiscalYear, 2025)
  assert.equal(gate.status, "ready")
  assert.equal(gate.visible, true)
  assert.equal(gate.quality.activeCounterpartyCount, 1)
  assert.equal(gate.quality.missingTaxIdCount, 0)
  assert.equal(gate.blockingReasons.length, 0)
})

test("getModel347Gate bloquea el modelo cuando faltan NIFs en terceros activos", () => {
  const gate = getModel347Gate({
    fiscalYear: 2025,
    profile: createProfile(),
    counterparties: [
      createCounterparty({ id: "cp_missing", taxId: null, taxIdNormalized: "none" }),
      createCounterparty({ id: "cp_ok", taxId: "B76543210", taxIdNormalized: "B76543210" }),
    ],
  })

  assert.equal(gate.status, "blocked_counterparty_quality")
  assert.equal(gate.visible, false)
  assert.equal(gate.quality.activeCounterpartyCount, 2)
  assert.equal(gate.quality.withTaxIdCount, 1)
  assert.equal(gate.quality.missingTaxIdCount, 1)
  assert.deepEqual(gate.blockingReasons, [
    "Hay terceros activos sin NIF consolidado. Completa la resolucion de contraparte antes de preparar el modelo 347.",
  ])
})
