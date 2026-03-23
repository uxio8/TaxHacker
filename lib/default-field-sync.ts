export type DefaultFieldSeed = {
  code: string
  name: string
  type: string
  llm_prompt: string
  isVisibleInList: boolean
  isVisibleInAnalysis: boolean
  isRequired: boolean
  isExtra: boolean
}

export const DEFAULTS_SYNC_VERSION = 4
export const DEFAULTS_SYNC_VERSION_SETTING_CODE = "defaults_sync_version"

export const LEGACY_DEFAULT_PROMPT_ANALYSE_NEW_FILE = `You are an accountant and invoice analysis assistant. Extract following information from the given invoice: 

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

export const PREVIOUS_DEFAULT_PROMPT_ANALYSE_NEW_FILE = `You are an accountant and invoice analysis assistant. Extract following information from the given invoice: 

{fields}

Pay special attention to these invoice-level fields when present:
- invoice_number
- billing_company_name
- billing_tax_id
- billing_address
- billing_postal_code
- billing_city
- billing_country

Also try to extract "items": all separate products or items from the invoice

Where categories are:

{categories}

And projects are:

{projects}

IMPORTANT RULES:
- Do not include any other text in your response!
- If you can't find something leave it blank, NEVER make up information
- Keep billing details exactly as written on the invoice
- Return only one object`

export const PREVIOUS_CURRENT_DEFAULT_PROMPT_ANALYSE_NEW_FILE = `Eres un asistente de contabilidad y análisis de facturas. Extrae la siguiente información de la factura proporcionada:

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
- Devuelve un único objeto`

export const CURRENT_DEFAULT_PROMPT_ANALYSE_NEW_FILE = `Eres un asistente de contabilidad y análisis de facturas. Extrae la siguiente información de la factura proporcionada:

{fields}

Presta especial atención a estos campos de nivel factura cuando aparezcan:
- invoice_number
- billing_company_name
- billing_tax_id
- billing_address
- billing_postal_code
- billing_city
- billing_country

Los campos billing_* representan siempre a la empresa emisora o proveedora de la factura, nunca a la empresa receptora o al cliente facturado.

Intenta extraer también "items": todos los productos o conceptos separados que aparezcan en la factura

Donde las categorías son:

{categories}

Y los proyectos son:

{projects}

REGLAS IMPORTANTES:
- No incluyas ningún otro texto en tu respuesta
- Si no encuentras un dato, déjalo en blanco; NUNCA inventes información
- Conserva los datos del emisor exactamente como aparecen en la factura
- Devuelve un único objeto`

export const LEGACY_EXTRA_BILLING_DEFAULT_FIELDS: DefaultFieldSeed[] = [
  {
    code: "invoice_number",
    name: "Invoice Number",
    type: "string",
    llm_prompt: "invoice number, invoice id, document number, or serial number",
    isVisibleInList: false,
    isVisibleInAnalysis: true,
    isRequired: false,
    isExtra: true,
  },
  {
    code: "billing_company_name",
    name: "Billing Company Name",
    type: "string",
    llm_prompt: "billing company legal name or billed customer name",
    isVisibleInList: false,
    isVisibleInAnalysis: true,
    isRequired: false,
    isExtra: true,
  },
  {
    code: "billing_tax_id",
    name: "Billing Tax ID",
    type: "string",
    llm_prompt: "billing tax id, VAT number, fiscal id, or customer tax number",
    isVisibleInList: false,
    isVisibleInAnalysis: true,
    isRequired: false,
    isExtra: true,
  },
  {
    code: "billing_address",
    name: "Billing Address",
    type: "string",
    llm_prompt: "full billing street address of the billed customer or company",
    isVisibleInList: false,
    isVisibleInAnalysis: true,
    isRequired: false,
    isExtra: true,
  },
  {
    code: "billing_postal_code",
    name: "Billing Postal Code",
    type: "string",
    llm_prompt: "billing postal code or ZIP code",
    isVisibleInList: false,
    isVisibleInAnalysis: true,
    isRequired: false,
    isExtra: true,
  },
  {
    code: "billing_city",
    name: "Billing City",
    type: "string",
    llm_prompt: "billing city or town",
    isVisibleInList: false,
    isVisibleInAnalysis: true,
    isRequired: false,
    isExtra: true,
  },
  {
    code: "billing_country",
    name: "Billing Country",
    type: "string",
    llm_prompt: "billing country name or country code",
    isVisibleInList: false,
    isVisibleInAnalysis: true,
    isRequired: false,
    isExtra: true,
  },
]

export const PREVIOUS_EXTRA_BILLING_FIELD_LOCALIZATION: Partial<
  Record<DefaultFieldSeed["code"], Pick<DefaultFieldSeed, "llm_prompt" | "name">>
> = {
  billing_company_name: {
    name: "Razón social de facturación",
    llm_prompt: "razón social completa del cliente facturado o nombre legal de la empresa facturada",
  },
  billing_tax_id: {
    name: "NIF/CIF de facturación",
    llm_prompt: "NIF, CIF, VAT number, identificador fiscal o número fiscal del cliente facturado",
  },
  billing_address: {
    name: "Dirección de facturación",
    llm_prompt: "dirección completa de facturación del cliente o empresa facturada",
  },
  billing_postal_code: {
    name: "Código postal de facturación",
    llm_prompt: "código postal o ZIP de facturación",
  },
  billing_city: {
    name: "Ciudad de facturación",
    llm_prompt: "ciudad o localidad de facturación",
  },
  billing_country: {
    name: "País de facturación",
    llm_prompt: "nombre del país o código de país de facturación",
  },
}

const EXTRA_BILLING_FIELD_LOCALIZATION: Partial<
  Record<DefaultFieldSeed["code"], Pick<DefaultFieldSeed, "llm_prompt" | "name">>
> = {
  invoice_number: {
    name: "Número de factura",
    llm_prompt: "número de factura, id de factura, número de documento o número de serie",
  },
  billing_company_name: {
    name: "Razón social del emisor",
    llm_prompt: "razón social completa de la empresa emisora, proveedora o vendedora",
  },
  billing_tax_id: {
    name: "NIF/CIF del emisor",
    llm_prompt: "NIF, CIF, VAT number, identificador fiscal o número fiscal del emisor o proveedor",
  },
  billing_address: {
    name: "Dirección del emisor",
    llm_prompt: "dirección completa de la empresa emisora, proveedora o vendedora",
  },
  billing_postal_code: {
    name: "Código postal del emisor",
    llm_prompt: "código postal o ZIP del emisor o proveedor",
  },
  billing_city: {
    name: "Ciudad del emisor",
    llm_prompt: "ciudad o localidad del emisor o proveedor",
  },
  billing_country: {
    name: "País del emisor",
    llm_prompt: "nombre del país o código de país del emisor o proveedor",
  },
}

export const EXTRA_BILLING_DEFAULT_FIELDS: DefaultFieldSeed[] = LEGACY_EXTRA_BILLING_DEFAULT_FIELDS.map((field) => ({
  ...field,
  ...EXTRA_BILLING_FIELD_LOCALIZATION[field.code],
}))

export const EXTRA_BILLING_FIELD_CODES = EXTRA_BILLING_DEFAULT_FIELDS.map((field) => field.code)

export function getMissingDefaultFields(existingFieldCodes: string[]) {
  const existingCodes = new Set(existingFieldCodes)
  return EXTRA_BILLING_DEFAULT_FIELDS.filter((field) => !existingCodes.has(field.code))
}

export function shouldUpgradeDefaultAnalysisPrompt(prompt: string | null | undefined) {
  return (
    !prompt ||
    prompt === LEGACY_DEFAULT_PROMPT_ANALYSE_NEW_FILE ||
    prompt === PREVIOUS_DEFAULT_PROMPT_ANALYSE_NEW_FILE ||
    prompt === PREVIOUS_CURRENT_DEFAULT_PROMPT_ANALYSE_NEW_FILE
  )
}
