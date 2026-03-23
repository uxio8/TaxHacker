import { z } from "zod"

export const COUNTERPARTY_FORM_DEFAULTS = {
  countryCode: "ES",
  isActive: true,
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

const optionalStringSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => {
    if (!value) {
      return undefined
    }

    return value
  })

const optionalNullableStringSchema = z
  .string()
  .trim()
  .max(64, { message: "El NIF del tercero no puede superar los 64 caracteres" })
  .optional()
  .transform((value) => {
    if (!value) {
      return null
    }

    return value
  })

const booleanFieldSchema = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .optional()
  .default(COUNTERPARTY_FORM_DEFAULTS.isActive)
  .transform((value) => value === true || value === "true")

export const counterpartyFormSchema = z.object({
  counterpartyId: optionalStringSchema,
  displayName: z
    .string()
    .trim()
    .min(1, { message: "El nombre visible del tercero es obligatorio" })
    .max(128, { message: "El nombre visible del tercero no puede superar los 128 caracteres" })
    .transform(collapseWhitespace),
  taxId: optionalNullableStringSchema,
  countryCode: fixedValueSchema(
    COUNTERPARTY_FORM_DEFAULTS.countryCode,
    `Counterparty V1 solo admite countryCode=${COUNTERPARTY_FORM_DEFAULTS.countryCode}`
  ),
  isActive: booleanFieldSchema,
})

export type CounterpartyFormValues = z.infer<typeof counterpartyFormSchema>

export function parseCounterpartyFormData(input: FormData | Record<string, FormDataEntryValue | undefined>) {
  const values = input instanceof FormData ? Object.fromEntries(input) : input
  return counterpartyFormSchema.safeParse(values)
}
