import assert from "node:assert/strict"
import test from "node:test"

import {
  COUNTERPARTY_FORM_DEFAULTS,
  counterpartyFormSchema,
  parseCounterpartyFormData,
} from "../../../forms/fiscal/counterparties.ts"

test("counterpartyFormSchema normaliza nombre, limpia NIF vacio y aplica defaults de V1", () => {
  const parsed = counterpartyFormSchema.parse({
    displayName: "  Papeleria    Centro   SL  ",
    taxId: "   ",
  })

  assert.deepEqual(parsed, {
    displayName: "Papeleria Centro SL",
    taxId: null,
    isActive: true,
    ...COUNTERPARTY_FORM_DEFAULTS,
  })
})

test("parseCounterpartyFormData respeta el checkbox activo y acepta edicion por id", () => {
  const formData = new FormData()
  formData.set("counterpartyId", "cp_123")
  formData.set("displayName", "Cliente Demo SL")
  formData.set("taxId", "B12345678")
  formData.set("countryCode", "ES")
  formData.set("isActive", "false")

  const parsed = parseCounterpartyFormData(formData)

  assert.equal(parsed.success, true)
  assert.deepEqual(parsed.data, {
    counterpartyId: "cp_123",
    displayName: "Cliente Demo SL",
    taxId: "B12345678",
    countryCode: "ES",
    isActive: false,
  })
})

test("parseCounterpartyFormData resuelve checkbox marcado sobre el hidden false", () => {
  const formData = new FormData()
  formData.append("displayName", "Cliente Demo SL")
  formData.append("taxId", "")
  formData.append("countryCode", "ES")
  formData.append("isActive", "false")
  formData.append("isActive", "true")

  const parsed = parseCounterpartyFormData(formData)

  assert.equal(parsed.success, true)
  assert.equal(parsed.data?.isActive, true)
})

test("counterpartyFormSchema exige nombre visible y limita el pais a ES", () => {
  const result = counterpartyFormSchema.safeParse({
    displayName: "   ",
    countryCode: "PT",
  })

  assert.equal(result.success, false)
  assert.match(result.error.issues[0]?.message ?? "", /nombre visible/i)
  assert.match(result.error.issues[1]?.message ?? "", /countryCode=ES/i)
})
