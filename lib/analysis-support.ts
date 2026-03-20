const ANALYZEABLE_FILE_KINDS = {
  pdf: "application/pdf",
  imagePrefix: "image/",
} as const

export function canAnalyzeFileMimeType(mimeType: string) {
  return mimeType === ANALYZEABLE_FILE_KINDS.pdf || mimeType.startsWith(ANALYZEABLE_FILE_KINDS.imagePrefix)
}

export function getAnalyzeMimeTypeError(mimeType: string) {
  return `AI analysis does not support ${mimeType} yet. Upload an image or PDF instead.`
}
