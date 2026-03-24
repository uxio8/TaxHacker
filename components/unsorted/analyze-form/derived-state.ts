import { buildUnsortedInboxSummary, type UnsortedInboxSummary } from "@/models/unsorted-inbox"
import type { Field, File } from "@/prisma/client"

const INVOICE_FIELD_CODES = new Set(["invoice_number"])
const BILLING_FIELD_CODES = new Set([
  "billing_company_name",
  "billing_tax_id",
  "billing_address",
  "billing_postal_code",
  "billing_city",
  "billing_country",
])

export type AnalyzeFormFieldMap = Record<string, Field>

export function buildAnalyzeFormDerivedState(fields: Field[]) {
  const fieldMap = fields.reduce(
    (acc, field) => {
      acc[field.code] = field
      return acc
    },
    {} as AnalyzeFormFieldMap
  )

  const extraFields = fields.filter((field) => field.isExtra)
  const invoiceFields = extraFields.filter((field) => INVOICE_FIELD_CODES.has(field.code))
  const issuerFields = extraFields.filter((field) => BILLING_FIELD_CODES.has(field.code))
  const remainingExtraFields = extraFields.filter(
    (field) => !INVOICE_FIELD_CODES.has(field.code) && !BILLING_FIELD_CODES.has(field.code)
  )

  return {
    fieldMap,
    extraFields,
    invoiceFields,
    issuerFields,
    remainingExtraFields,
  }
}

export function buildAnalyzeFormEffectiveSummary({
  file,
  summary,
  localCachedParseResult,
}: {
  file: File
  summary: UnsortedInboxSummary
  localCachedParseResult: Record<string, unknown> | null
}) {
  return buildUnsortedInboxSummary({
    file: {
      id: file.id,
      filename: file.filename,
      mimetype: file.mimetype,
      metadata: file.metadata,
      cachedParseResult: localCachedParseResult,
      isSplitted: file.isSplitted,
    },
    llmConfigured: summary.primaryAction.kind !== "open_settings",
  })
}
