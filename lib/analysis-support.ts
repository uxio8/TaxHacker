import { t } from "./i18n/core.ts"

const ANALYZEABLE_FILE_KINDS = {
  pdf: "application/pdf",
  imagePrefix: "image/",
} as const

export function canAnalyzeFileMimeType(mimeType: string) {
  return mimeType === ANALYZEABLE_FILE_KINDS.pdf || mimeType.startsWith(ANALYZEABLE_FILE_KINDS.imagePrefix)
}

export function getAnalyzeMimeTypeError(mimeType: string) {
  return t("analysis.unsupportedMimeType", { values: { mimeType } })
}
