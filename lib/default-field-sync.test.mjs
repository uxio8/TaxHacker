import assert from "node:assert/strict"
import test from "node:test"

import { transactionFormSchema } from "../forms/transactions.ts"
import {
  CURRENT_DEFAULT_PROMPT_ANALYSE_NEW_FILE,
  DEFAULTS_SYNC_VERSION,
  EXTRA_BILLING_FIELD_CODES,
  PREVIOUS_DEFAULT_PROMPT_ANALYSE_NEW_FILE,
  getMissingDefaultFields,
  shouldUpgradeDefaultAnalysisPrompt,
} from "./default-field-sync.ts"

test("getMissingDefaultFields returns the new billing defaults that are absent", () => {
  const missingFields = getMissingDefaultFields(["name", "merchant", "description"])

  assert.deepEqual(
    missingFields.map((field) => field.code),
    EXTRA_BILLING_FIELD_CODES
  )
  assert.ok(missingFields.every((field) => field.type === "string"))
  assert.ok(missingFields.every((field) => field.isExtra))
  assert.ok(missingFields.every((field) => field.isVisibleInAnalysis))
})

test("shouldUpgradeDefaultAnalysisPrompt only migrates untouched legacy prompts", () => {
  assert.equal(shouldUpgradeDefaultAnalysisPrompt(undefined), true)
  assert.equal(shouldUpgradeDefaultAnalysisPrompt(""), true)
  assert.equal(shouldUpgradeDefaultAnalysisPrompt(PREVIOUS_DEFAULT_PROMPT_ANALYSE_NEW_FILE), true)
  assert.equal(
    shouldUpgradeDefaultAnalysisPrompt(`Eres un asistente de contabilidad y análisis de facturas. Extrae la siguiente información de la factura proporcionada:

{fields}

Presta especial atención a estos campos de nivel factura cuando aparezcan:
- invoice_number
- billing_company_name
- billing_tax_id
- billing_address
- billing_postal_code
- billing_city
- billing_country

Intenta extraer también "items": todos los productos o conceptos separados que aparezcan en la factura

Donde las categorías son:

{categories}

Y los proyectos son:

{projects}

REGLAS IMPORTANTES:
- No incluyas ningún otro texto en tu respuesta
- Si no encuentras un dato, déjalo en blanco; NUNCA inventes información
- Conserva los datos de facturación exactamente como aparecen en la factura
- Devuelve un único objeto`),
    true
  )
  assert.equal(
    shouldUpgradeDefaultAnalysisPrompt(
      `You are an accountant and invoice analysis assistant. Extract following information from the given invoice: 

{fields}

Also try to extract "items": all separate products or items from the invoice

Where categories are:

{categories}

And projects are:

{projects}

IMPORTANT RULES:
- Do not include any other text in your response!
- If you can't find something leave it blank, NEVER make up information
- Return only one object`
    ),
    true
  )
  assert.equal(shouldUpgradeDefaultAnalysisPrompt("Prompt personalizado del usuario"), false)
})

test("defaults sync version is an explicit positive integer", () => {
  assert.equal(Number.isInteger(DEFAULTS_SYNC_VERSION), true)
  assert.ok(DEFAULTS_SYNC_VERSION > 0)
})

test("billing defaults describe the invoice issuer rather than the billed customer", () => {
  const fieldsByCode = Object.fromEntries(getMissingDefaultFields([]).map((field) => [field.code, field]))

  assert.match(fieldsByCode.billing_company_name.name, /emisor|proveedor/i)
  assert.match(fieldsByCode.billing_company_name.llm_prompt, /emisor|proveedor/i)
  assert.doesNotMatch(fieldsByCode.billing_company_name.llm_prompt, /cliente facturado|empresa facturada/i)
  assert.match(CURRENT_DEFAULT_PROMPT_ANALYSE_NEW_FILE, /emisor|proveedor/i)
})

test("transactionFormSchema preserves arbitrary extra string fields for saving", () => {
  const parsed = transactionFormSchema.parse({
    name: "Factura marzo",
    invoice_number: "INV-2026-0031",
    billing_company_name: "Acme SL",
    billing_tax_id: "ESB12345678",
    billing_address: "Calle Mayor 1",
    billing_postal_code: "28001",
    billing_city: "Madrid",
    billing_country: "ES",
  })

  assert.equal(parsed.invoice_number, "INV-2026-0031")
  assert.equal(parsed.billing_company_name, "Acme SL")
  assert.equal(parsed.billing_tax_id, "ESB12345678")
  assert.equal(parsed.billing_address, "Calle Mayor 1")
  assert.equal(parsed.billing_postal_code, "28001")
  assert.equal(parsed.billing_city, "Madrid")
  assert.equal(parsed.billing_country, "ES")
})
