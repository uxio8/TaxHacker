import assert from "node:assert/strict"
import test from "node:test"

import { userFormSchema } from "./users.ts"

test("userFormSchema acepta businessTaxId como campo opcional de negocio", () => {
  const parsed = userFormSchema.safeParse({
    businessName: "LedgerFlow Studio SL",
    businessTaxId: "B12345678",
  })

  assert.equal(parsed.success, true)
  assert.equal(parsed.data.businessTaxId, "B12345678")
})
