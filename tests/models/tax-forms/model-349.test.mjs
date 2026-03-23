import assert from "node:assert/strict"
import test from "node:test"

import { getModel349Gate } from "../../../models/tax-forms/model-349.ts"

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
    displayName: "Cliente UE Demo",
    taxId: "EU123456789",
    taxIdNormalized: "EU123456789",
    countryCode: "ES",
    canonicalIdentityKey: "ES:NIF:EU123456789",
    normalizedName: "CLIENTE UE DEMO",
    identityBasis: "tax_id",
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  }
}

test("getModel349Gate bloquea el modelo cuando el perfil fiscal no declara operativa intracomunitaria", () => {
  const gate = getModel349Gate({
    fiscalYear: 2025,
    profile: createProfile({ hasIntraEuOperations: false }),
    counterparties: [createCounterparty()],
  })

  assert.equal(gate.status, "blocked_profile")
  assert.equal(gate.visible, false)
  assert.deepEqual(gate.blockingReasons, [
    "El perfil fiscal no declara operaciones intracomunitarias. Activalas antes de abrir el modelo 349.",
  ])
})

test("getModel349Gate habilita el modelo cuando hay operativa intracomunitaria y terceros con NIF usable", () => {
  const gate = getModel349Gate({
    fiscalYear: 2025,
    profile: createProfile({ hasIntraEuOperations: true }),
    counterparties: [createCounterparty()],
  })

  assert.equal(gate.obligationCode, "349")
  assert.equal(gate.status, "ready")
  assert.equal(gate.visible, true)
  assert.equal(gate.quality.activeCounterpartyCount, 1)
  assert.equal(gate.quality.missingTaxIdCount, 0)
  assert.deepEqual(gate.blockingReasons, [])
})
