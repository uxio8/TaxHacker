import { z } from "zod"

export const FISCAL_PROFILE_FORM_DEFAULTS = {
  countryCode: "ES",
  currencyCode: "EUR",
  legalEntityType: "spanish_sl",
} as const

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ")
}

function fixedValueSchema(expectedValue: string, message: string) {
  return z
    .string()
    .trim()
    .optional()
    .default(expectedValue)
    .refine((value) => value === expectedValue, { message })
}

const booleanFieldSchema = z.preprocess((value) => {
  if (value === true || value === "true" || value === "on") {
    return true
  }

  if (value === false || value === "false" || value === undefined) {
    return false
  }

  return value
}, z.boolean())

const monthFieldSchema = z.preprocess((value) => {
  if (typeof value === "string" && value.trim()) {
    return Number(value)
  }

  return value
}, z.number().int().min(1).max(12))

export const fiscalProfileFormSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(1, { message: "El nombre fiscal de la empresa es obligatorio" })
    .max(128, { message: "El nombre fiscal de la empresa no puede superar los 128 caracteres" })
    .transform(collapseWhitespace),
  taxId: z
    .string()
    .trim()
    .min(1, { message: "El NIF fiscal es obligatorio" })
    .max(64, { message: "El NIF fiscal no puede superar los 64 caracteres" }),
  countryCode: fixedValueSchema(
    FISCAL_PROFILE_FORM_DEFAULTS.countryCode,
    `FiscalProfile V1 solo admite countryCode=${FISCAL_PROFILE_FORM_DEFAULTS.countryCode}`
  ),
  currencyCode: fixedValueSchema(
    FISCAL_PROFILE_FORM_DEFAULTS.currencyCode,
    `FiscalProfile V1 solo admite currencyCode=${FISCAL_PROFILE_FORM_DEFAULTS.currencyCode}`
  ),
  legalEntityType: fixedValueSchema(
    FISCAL_PROFILE_FORM_DEFAULTS.legalEntityType,
    `FiscalProfile V1 solo admite legalEntityType=${FISCAL_PROFILE_FORM_DEFAULTS.legalEntityType}`
  ),
  vatCashAccountingEnabled: booleanFieldSchema.optional().default(false),
  hasEmployees: booleanFieldSchema.optional().default(false),
  hasRentWithholding: booleanFieldSchema.optional().default(false),
  hasProfessionalWithholding: booleanFieldSchema.optional().default(false),
  hasIntraEuOperations: booleanFieldSchema.optional().default(false),
  issuesInvoices: booleanFieldSchema.optional().default(true),
  annualCloseMonth: monthFieldSchema.optional().default(12),
})

export type FiscalProfileFormValues = z.infer<typeof fiscalProfileFormSchema>
