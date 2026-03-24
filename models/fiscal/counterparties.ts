import type { Counterparty, Prisma, PrismaClient } from "../../prisma/client/index.js"
import { withFiscalStorageGuard } from "./storage.ts"

const COUNTERPARTY_COUNTRY_CODE = "ES" as const
const COUNTERPARTY_IDENTITY_BASIS_TAX_ID = "tax_id" as const
const COUNTERPARTY_IDENTITY_BASIS_NAME_FALLBACK = "name_fallback" as const
const COUNTERPARTY_EMPTY_TAX_ID = "none" as const
export const COUNTERPARTY_QUALITY_STATUS = {
  RELIABLE: "reliable",
  NEEDS_TAX_ID: "needs_tax_id",
  INACTIVE: "inactive",
} as const

export type CounterpartyIdentityBasis =
  | typeof COUNTERPARTY_IDENTITY_BASIS_TAX_ID
  | typeof COUNTERPARTY_IDENTITY_BASIS_NAME_FALLBACK

export type CounterpartyQualityStatus =
  (typeof COUNTERPARTY_QUALITY_STATUS)[keyof typeof COUNTERPARTY_QUALITY_STATUS]

export type CounterpartyInput = {
  displayName: string
  taxId?: string | null
  countryCode?: string | null
  isActive?: boolean
}

export type CounterpartyIdentity = {
  canonicalIdentityKey: string
  countryCode: typeof COUNTERPARTY_COUNTRY_CODE
  displayName: string
  identityBasis: CounterpartyIdentityBasis
  normalizedName: string
  taxId: string | null
  taxIdNormalized: string
}

type CounterpartyQualityInput = Pick<Counterparty, "identityBasis" | "isActive" | "taxIdNormalized">

type CounterpartyStore = {
  $transaction?: <T>(callback: (store: CounterpartyStore) => Promise<T>) => Promise<T>
  counterparty: {
    create(args: {
      data: Omit<Counterparty, "id" | "createdAt" | "updatedAt">
    }): Promise<Counterparty>
    findFirst(args: {
      where: {
        id: string
        ownerScopeId: string
      }
    }): Promise<Counterparty | null>
    findMany(args: {
      where: { ownerScopeId: string }
      orderBy: { displayName: "asc" | "desc" }
    }): Promise<Counterparty[]>
    findUnique(args: {
      where: {
        ownerScopeId_canonicalIdentityKey: {
          ownerScopeId: string
          canonicalIdentityKey: string
        }
      }
    }): Promise<Counterparty | null>
    update(args: {
      where: { id: string }
      data: Omit<Counterparty, "id" | "ownerScopeId" | "createdAt" | "updatedAt">
    }): Promise<Counterparty>
  }
}

type CounterpartyDbClient = Pick<PrismaClient, "$transaction" | "counterparty">
type CounterpartyTransactionClient = Pick<Prisma.TransactionClient, "counterparty">

export class CounterpartyIdentityConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CounterpartyIdentityConflictError"
  }
}

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ")
}

function normalizeDisplayName(value: string): string {
  const normalized = collapseWhitespace(value)

  if (!normalized) {
    throw new Error("El nombre visible de la contraparte es obligatorio")
  }

  return normalized
}

export function normalizeCounterpartyTaxId(value?: string | null): string | null {
  if (!value) {
    return null
  }

  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "")

  return normalized || null
}

export function normalizeCounterpartyName(value: string): string {
  const normalized = collapseWhitespace(
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toUpperCase()
      .replace(/[^0-9A-Z]+/g, " ")
  )

  if (!normalized) {
    throw new Error("El nombre normalizado de la contraparte no puede quedar vacio")
  }

  return normalized
}

function buildCounterpartyNameFingerprint(normalizedName: string): string {
  return normalizedName.replace(/\s+/g, "_")
}

export function getCounterpartyQualityStatus(
  counterparty: CounterpartyQualityInput
): CounterpartyQualityStatus {
  if (!counterparty.isActive) {
    return COUNTERPARTY_QUALITY_STATUS.INACTIVE
  }

  if (
    counterparty.identityBasis === COUNTERPARTY_IDENTITY_BASIS_TAX_ID &&
    counterparty.taxIdNormalized !== COUNTERPARTY_EMPTY_TAX_ID
  ) {
    return COUNTERPARTY_QUALITY_STATUS.RELIABLE
  }

  return COUNTERPARTY_QUALITY_STATUS.NEEDS_TAX_ID
}

export function summarizeCounterpartyQuality(counterparties: CounterpartyQualityInput[]) {
  const summary = {
    reliable: 0,
    needs_tax_id: 0,
    inactive: 0,
  }

  for (const counterparty of counterparties) {
    const status = getCounterpartyQualityStatus(counterparty)

    if (status === COUNTERPARTY_QUALITY_STATUS.RELIABLE) {
      summary.reliable += 1
      continue
    }

    if (status === COUNTERPARTY_QUALITY_STATUS.NEEDS_TAX_ID) {
      summary.needs_tax_id += 1
      continue
    }

    summary.inactive += 1
  }

  return summary
}

function assertCounterpartyCountryCode(countryCode?: string | null) {
  if ((countryCode ?? COUNTERPARTY_COUNTRY_CODE) !== COUNTERPARTY_COUNTRY_CODE) {
    throw new Error(`Counterparty V1 solo admite countryCode=${COUNTERPARTY_COUNTRY_CODE}`)
  }
}

export function buildCounterpartyIdentity(input: CounterpartyInput): CounterpartyIdentity {
  assertCounterpartyCountryCode(input.countryCode)

  const displayName = normalizeDisplayName(input.displayName)
  const normalizedName = normalizeCounterpartyName(displayName)
  const taxId = normalizeCounterpartyTaxId(input.taxId)

  if (taxId) {
    return {
      canonicalIdentityKey: `${COUNTERPARTY_COUNTRY_CODE}:NIF:${taxId}`,
      countryCode: COUNTERPARTY_COUNTRY_CODE,
      displayName,
      identityBasis: COUNTERPARTY_IDENTITY_BASIS_TAX_ID,
      normalizedName,
      taxId,
      taxIdNormalized: taxId,
    }
  }

  return {
    canonicalIdentityKey: `${COUNTERPARTY_COUNTRY_CODE}:NAME:${buildCounterpartyNameFingerprint(normalizedName)}`,
    countryCode: COUNTERPARTY_COUNTRY_CODE,
    displayName,
    identityBasis: COUNTERPARTY_IDENTITY_BASIS_NAME_FALLBACK,
    normalizedName,
    taxId: null,
    taxIdNormalized: COUNTERPARTY_EMPTY_TAX_ID,
  }
}

function buildFallbackCanonicalIdentityKey(displayName: string): string {
  const normalizedName = normalizeCounterpartyName(displayName)
  return `${COUNTERPARTY_COUNTRY_CODE}:NAME:${buildCounterpartyNameFingerprint(normalizedName)}`
}

async function findCounterpartyByCanonicalIdentityFromStore(
  ownerScopeId: string,
  canonicalIdentityKey: string,
  store: CounterpartyStore
) {
  return store.counterparty.findUnique({
    where: {
      ownerScopeId_canonicalIdentityKey: {
        ownerScopeId,
        canonicalIdentityKey,
      },
    },
  })
}

function hasTransaction(
  store: CounterpartyDbClient | CounterpartyTransactionClient
): store is CounterpartyDbClient {
  return "$transaction" in store
}

function createCounterpartyStore(
  db: CounterpartyDbClient | CounterpartyTransactionClient
): CounterpartyStore {
  const store: CounterpartyStore = {
    counterparty: {
      create(args) {
        return db.counterparty.create(args)
      },
      findFirst(args) {
        return db.counterparty.findFirst(args)
      },
      findMany(args) {
        return db.counterparty.findMany(args)
      },
      findUnique(args) {
        return db.counterparty.findUnique(args)
      },
      update(args) {
        return db.counterparty.update(args)
      },
    },
  }

  if (!hasTransaction(db)) {
    return store
  }

  return {
    ...store,
    $transaction(callback) {
      return db.$transaction((tx) => callback(createCounterpartyStore(tx)))
    },
  }
}

async function resolveStore(store?: CounterpartyStore): Promise<CounterpartyStore> {
  if (store) {
    return store
  }

  const { prisma } = await import("../../lib/db.ts")
  return createCounterpartyStore(prisma)
}

function isUniqueConstraintError(error: unknown): error is { code: string } {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002"
}

async function runInTransaction<T>(store: CounterpartyStore, callback: (store: CounterpartyStore) => Promise<T>): Promise<T> {
  if (store.$transaction) {
    return store.$transaction(callback)
  }

  return callback(store)
}

async function upsertCounterpartyInStore(
  ownerScopeId: string,
  input: CounterpartyInput,
  store: CounterpartyStore
): Promise<Counterparty> {
  const identity = buildCounterpartyIdentity(input)
  const existingByCanonical = await findCounterpartyByCanonicalIdentityFromStore(
    ownerScopeId,
    identity.canonicalIdentityKey,
    store
  )

  let existingByFallback: Counterparty | null = null

  if (identity.identityBasis === COUNTERPARTY_IDENTITY_BASIS_TAX_ID) {
    const fallbackCanonicalIdentityKey = buildFallbackCanonicalIdentityKey(identity.displayName)

    if (fallbackCanonicalIdentityKey !== identity.canonicalIdentityKey) {
      existingByFallback = await findCounterpartyByCanonicalIdentityFromStore(
        ownerScopeId,
        fallbackCanonicalIdentityKey,
        store
      )
    }
  }

  if (
    existingByCanonical &&
    existingByFallback &&
    existingByCanonical.id !== existingByFallback.id
  ) {
    throw new CounterpartyIdentityConflictError(
      "La consolidacion de la contraparte colisiona con otra identidad canonica existente"
    )
  }

  const current = existingByCanonical ?? existingByFallback

  if (current) {
    return store.counterparty.update({
      where: { id: current.id },
      data: {
        canonicalIdentityKey: identity.canonicalIdentityKey,
        identityBasis: identity.identityBasis,
        displayName: identity.displayName,
        normalizedName: identity.normalizedName,
        taxId: identity.taxId,
        taxIdNormalized: identity.taxIdNormalized,
        countryCode: identity.countryCode,
        isActive: input.isActive ?? current.isActive,
      },
    })
  }

  return store.counterparty.create({
    data: {
      ownerScopeId,
      canonicalIdentityKey: identity.canonicalIdentityKey,
      identityBasis: identity.identityBasis,
      displayName: identity.displayName,
      normalizedName: identity.normalizedName,
      taxId: identity.taxId,
      taxIdNormalized: identity.taxIdNormalized,
      countryCode: identity.countryCode,
      isActive: input.isActive ?? true,
    },
  })
}

export async function getCounterparties(
  ownerScopeId: string,
  store?: CounterpartyStore
): Promise<Counterparty[]> {
  return withFiscalStorageGuard(async () => {
    const db = await resolveStore(store)

    return db.counterparty.findMany({
      where: { ownerScopeId },
      orderBy: { displayName: "asc" },
    })
  })
}

export async function getCounterpartyById(
  id: string,
  ownerScopeId: string,
  store?: CounterpartyStore
): Promise<Counterparty | null> {
  return withFiscalStorageGuard(async () => {
    const db = await resolveStore(store)

    return db.counterparty.findFirst({
      where: {
        id,
        ownerScopeId,
      },
    })
  })
}

export async function upsertCounterparty(
  ownerScopeId: string,
  input: CounterpartyInput,
  store?: CounterpartyStore
): Promise<Counterparty> {
  return withFiscalStorageGuard(async () => {
    const db = await resolveStore(store)
    let lastError: unknown = null

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await runInTransaction(db, async (tx) => upsertCounterpartyInStore(ownerScopeId, input, tx))
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error
        }

        lastError = error
      }
    }

    throw new CounterpartyIdentityConflictError(
      `No se pudo consolidar la contraparte tras reintentar la colision concurrente: ${String(
        (lastError as { code?: string } | null)?.code ?? "unknown"
      )}`
    )
  })
}
