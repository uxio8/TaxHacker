import assert from "node:assert/strict"
import test from "node:test"

import { getCounterpartyResolutionQualityStatus } from "../../../models/fiscal/counterparty-resolution.ts"
import {
  deriveCounterpartyQualityGate,
  getAffectedObligationsForCounterpartyReviewGate,
} from "../../../models/fiscal/review-status.ts"

test("deriveCounterpartyQualityGate bloquea 115 y 180 si falta la identidad fiscal del arrendador", () => {
  const gate = deriveCounterpartyQualityGate(
    {
      counterparty_id: null,
      counterparty_tax_id: null,
      counterparty_role: "landlord",
      counterparty_country_code: "ES",
      document_kind: "received_invoice",
    },
    [{ withholding_applicable: true, withholding_regime: "rent" }]
  )

  assert.deepEqual(gate.blockedObligationCodes, ["115", "180", "347"])
  assert.match(gate.blockingReasons[0] ?? "", /arrendador/i)
})

test("deriveCounterpartyQualityGate bloquea 349 cuando una contraparte UE no trae identificador fiscal", () => {
  const gate = deriveCounterpartyQualityGate(
    {
      counterparty_id: "cp_ue_1",
      counterparty_tax_id: null,
      counterparty_role: "supplier",
      counterparty_country_code: "DE",
      document_kind: "received_invoice",
    },
    [{ withholding_applicable: false, withholding_regime: "none" }]
  )

  assert.deepEqual(gate.blockedObligationCodes, ["347", "349"])
})

test("getAffectedObligationsForCounterpartyReviewGate traduce razones de revisión a obligaciones", () => {
  assert.deepEqual(
    getAffectedObligationsForCounterpartyReviewGate({
      reviewReasons: ["missing_counterparty_relation", "missing_counterparty_tax_id"],
      counterpartyRole: "landlord",
      counterpartyCountryCode: "ES",
    }),
    ["115", "180"]
  )

  assert.deepEqual(
    getAffectedObligationsForCounterpartyReviewGate({
      reviewReasons: ["employee_payroll_source_missing"],
      counterpartyRole: "employee",
      counterpartyCountryCode: "ES",
    }),
    ["111_manual"]
  )
})

test("getCounterpartyResolutionQualityStatus solo marca fiable el autolink por NIF", () => {
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
