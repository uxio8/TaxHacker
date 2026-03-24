import { getAnalyzedDocumentTitle } from "../../lib/analyzed-file-name.ts"

type AnalyzeFormCachedParseResult = Record<string, unknown> | null | undefined

type AnalyzeFormExtraField = {
  code: string
}

type AnalyzeFormSettings = {
  default_type?: string
  default_currency?: string
  default_category?: string
  default_project?: string
}

type AnalyzeFormStateOptions = {
  filename: string
  cachedParseResult: AnalyzeFormCachedParseResult
  settings: AnalyzeFormSettings
  extraFields: AnalyzeFormExtraField[]
}

export function buildAnalyzeFormState({
  filename,
  cachedParseResult,
  settings,
  extraFields,
}: AnalyzeFormStateOptions) {
  const baseState = {
    name: getAnalyzedDocumentTitle(filename, cachedParseResult),
    merchant: "",
    description: "",
    type: settings.default_type || "",
    total: 0.0,
    currencyCode: settings.default_currency || "",
    convertedTotal: 0.0,
    convertedCurrencyCode: settings.default_currency || "",
    categoryCode: settings.default_category || "",
    projectCode: settings.default_project || "",
    issuedAt: "",
    note: "",
    text: "",
    items: [],
  }

  const extraFieldsState = extraFields.reduce(
    (acc, field) => {
      acc[field.code] = ""
      return acc
    },
    {} as Record<string, string>
  )

  const cachedResults = cachedParseResult
    ? Object.fromEntries(
        Object.entries(cachedParseResult).filter(([, value]) => value !== null && value !== undefined && value !== "")
      )
    : {}

  return {
    ...baseState,
    ...extraFieldsState,
    ...cachedResults,
    name: getAnalyzedDocumentTitle(filename, cachedParseResult),
  }
}
