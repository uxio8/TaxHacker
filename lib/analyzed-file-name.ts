import { buildTransactionDocumentTitle, buildTransactionFileName } from "./transaction-file-name.ts"

type AnalyzedFileResult = Record<string, unknown> | null | undefined

export function getAnalyzedDocumentTitle(originalFilename: string, analysisResult: AnalyzedFileResult) {
  if (analysisResult) {
    const title = buildTransactionDocumentTitle(analysisResult)
    if (title) {
      return title
    }
  }

  return stripFileExtension(originalFilename)
}

export function getAnalyzedFileName(originalFilename: string, analysisResult: AnalyzedFileResult) {
  if (!analysisResult) {
    return originalFilename
  }

  return buildTransactionFileName(originalFilename, analysisResult) || originalFilename
}

function stripFileExtension(filename: string) {
  const normalizedFilename = filename.split(/[/\\]/).pop() || filename
  const lastDotIndex = normalizedFilename.lastIndexOf(".")

  if (lastDotIndex <= 0) {
    return normalizedFilename
  }

  return normalizedFilename.slice(0, lastDotIndex)
}
