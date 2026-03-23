import assert from "node:assert/strict"
import test from "node:test"

import { buildLLMPrompt } from "../ai/prompt.ts"

const fields = [
  { code: "name", llm_prompt: "nombre legible" },
  { code: "billing_company_name", llm_prompt: "razón social de la empresa emisora o proveedora" },
]

test("buildLLMPrompt añade contexto de nuestra empresa para distinguir receptor y emisor", () => {
  const prompt = buildLLMPrompt("Extrae:\n{fields}", fields, [], [], {
    businessName: "LedgerFlow Studio SL",
    businessAddress: "Calle Mayor 1, 28001 Madrid",
    businessTaxId: "B12345678",
  })

  assert.match(prompt, /billing_\*.*emisor|billing_\*.*proveedor/i)
  assert.match(prompt, /LedgerFlow Studio SL/)
  assert.match(prompt, /Calle Mayor 1, 28001 Madrid/)
  assert.match(prompt, /B12345678/)
  assert.match(prompt, /identificador fiscal|nif|cif|vat/i)
  assert.match(prompt, /receptor|cliente/i)
})

test("buildLLMPrompt sigue funcionando sin datos de negocio del usuario", () => {
  const prompt = buildLLMPrompt("Extrae:\n{fields}", fields)

  assert.match(prompt, /billing_\*.*emisor|billing_\*.*proveedor/i)
  assert.doesNotMatch(prompt, /undefined|null/)
})
