import assert from "node:assert/strict"
import test from "node:test"

import { buildAnalyzeFormState } from "./analyze-form-state.ts"

test("buildAnalyzeFormState mantiene el titulo analizado en el campo nombre aunque cachedParseResult traiga otro name", () => {
  const state = buildAnalyzeFormState({
    filename: "081-0003-488197 (11-03-26) LEROY MERLIN CORUNA.pdf",
    cachedParseResult: {
      name: "Compra de materiales de bricolaje y ferretería",
      merchant: "LEROY MERLIN CORUNA",
      description: "Factura Leroy Merlin",
      invoice_number: "081-0003-488197",
      issuedAt: "2026-03-11",
    },
    settings: {
      default_type: "expense",
      default_currency: "EUR",
      default_category: "tools",
      default_project: "vibra",
    },
    extraFields: [{ code: "invoice_number" }],
  })

  assert.equal(state.name, "081-0003-488197 (11/03/26) LEROY MERLIN CORUNA")
  assert.equal(state.description, "Factura Leroy Merlin")
  assert.equal(state.merchant, "LEROY MERLIN CORUNA")
  assert.equal(state.invoice_number, "081-0003-488197")
})
