import { format } from "date-fns"
import path from "path"

type TransactionFileNameSource = {
  merchant?: unknown
  billing_company_name?: unknown
  invoice_number?: unknown
  issuedAt?: Date | string | null
  extra?: unknown
}

export function buildTransactionDocumentTitle(
  source: TransactionFileNameSource,
  options?: { dateFormat?: string }
): string | null {
  const invoiceNumber = sanitizeInvoiceNumber(readField(source, "invoice_number"))
  const issuedAt = formatIssuedAt(source.issuedAt, options?.dateFormat || "dd/MM/yy")
  const merchant = sanitizeText(readField(source, "merchant")) || sanitizeText(readField(source, "billing_company_name"))

  const parts = [invoiceNumber, issuedAt ? `(${issuedAt})` : null, merchant].filter(
    (part): part is string => Boolean(part)
  )

  if (parts.length === 0) {
    return null
  }

  return parts.join(" ")
}

export function buildTransactionFileName(
  originalFilename: string,
  source: TransactionFileNameSource
): string | null {
  const extension = path.extname(originalFilename)
  const title = buildTransactionDocumentTitle(source, { dateFormat: "dd-MM-yy" })
  if (!title) {
    return null
  }

  return `${title}${extension}`
}

function readField(source: TransactionFileNameSource, key: "merchant" | "billing_company_name" | "invoice_number") {
  const directValue = source[key]
  if (typeof directValue === "string") {
    return directValue
  }

  const extraValue = getExtraRecord(source.extra)?.[key]
  return typeof extraValue === "string" ? extraValue : null
}

function getExtraRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function formatIssuedAt(value: Date | string | null | undefined, pattern: string) {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return format(date, pattern)
}

function sanitizeInvoiceNumber(value: string | null) {
  if (!value) {
    return null
  }

  return trimProblematicEdges(
    value
      .replace(UNSAFE_FILENAME_CHARS, "-")
      .replace(/\s+/g, " ")
      .replace(/\s*-\s*/g, "-")
      .replace(/-+/g, "-")
      .trim()
  )
}

function sanitizeText(value: string | null) {
  if (!value) {
    return null
  }

  return trimProblematicEdges(value.replace(UNSAFE_FILENAME_CHARS, " ").replace(/\s+/g, " ").trim())
}

function trimProblematicEdges(value: string) {
  const trimmed = value.replace(/^[.\-\s]+|[.\-\s]+$/g, "")
  return trimmed.length > 0 ? trimmed : null
}

const UNSAFE_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001F]/g
