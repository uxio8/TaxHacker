import { Prisma } from "../../prisma/client/index.js"

const FISCAL_STORAGE_TABLES = new Set([
  "fiscal_profiles",
  "counterparties",
  "transaction_fiscals",
  "transaction_fiscal_lines",
  "fiscal_periods",
  "fiscal_period_snapshots",
  "fiscal_audit_logs",
])

export const FISCAL_STORAGE_NOT_READY_MESSAGE =
  "El modulo fiscal no esta inicializado en esta base de datos. Faltan migraciones o tablas fiscales."

export class FiscalStorageNotReadyError extends Error {
  constructor(message = FISCAL_STORAGE_NOT_READY_MESSAGE) {
    super(message)
    this.name = "FiscalStorageNotReadyError"
  }
}

function isPrismaKnownRequestError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError
}

function normalizeTableName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim().toLowerCase()

  if (!normalized) {
    return null
  }

  const parts = normalized.split(".")
  return parts[parts.length - 1] ?? null
}

export function isFiscalStorageNotReadyError(error: unknown): error is FiscalStorageNotReadyError {
  return error instanceof FiscalStorageNotReadyError
}

export function toFiscalStorageNotReadyError(error: unknown): FiscalStorageNotReadyError | null {
  if (isFiscalStorageNotReadyError(error)) {
    return error
  }

  if (!isPrismaKnownRequestError(error) || error.code !== "P2021") {
    return null
  }

  const tableName = normalizeTableName(error.meta?.table)

  if (!tableName || !FISCAL_STORAGE_TABLES.has(tableName)) {
    return null
  }

  return new FiscalStorageNotReadyError()
}

export async function withFiscalStorageGuard<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    const storageError = toFiscalStorageNotReadyError(error)

    if (storageError) {
      throw storageError
    }

    throw error
  }
}
