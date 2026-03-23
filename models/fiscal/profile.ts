import type { FiscalProfile, Prisma, PrismaClient } from "../../prisma/client/index.js"
import { isFiscalStorageNotReadyError, withFiscalStorageGuard } from "./storage.ts"

export const FISCAL_PROFILE_COUNTRY_CODE = "ES" as const
export const FISCAL_PROFILE_CURRENCY_CODE = "EUR" as const
export const FISCAL_PROFILE_LEGAL_ENTITY_TYPE = "spanish_sl" as const

export type FiscalProfileInput = {
  companyName: string
  taxId: string
  countryCode?: string | null
  currencyCode?: string | null
  legalEntityType?: string | null
  vatCashAccountingEnabled?: boolean | null
  hasEmployees?: boolean | null
  hasRentWithholding?: boolean | null
  hasProfessionalWithholding?: boolean | null
  hasIntraEuOperations?: boolean | null
  issuesInvoices?: boolean | null
  annualCloseMonth?: number | null
}

const FISCAL_PROFILE_USER_SELECT = {
  id: true,
  defaultOrganizationId: true,
  businessName: true,
  businessTaxId: true,
} as const

type FiscalProfileUserRecord = Prisma.UserGetPayload<{
  select: typeof FISCAL_PROFILE_USER_SELECT
}>

type FiscalProfileStore = {
  user: {
    findUnique(args: {
      where: { id: string }
      select: typeof FISCAL_PROFILE_USER_SELECT
    }): Promise<FiscalProfileUserRecord | null>
  }
  fiscalProfile: {
    findUnique(args: { where: { organizationId: string } }): Promise<FiscalProfile | null>
    upsert(args: {
      where: { organizationId: string }
      update: Omit<FiscalProfile, "id" | "userId" | "organizationId" | "createdAt" | "updatedAt">
      create: Omit<FiscalProfile, "createdAt" | "updatedAt">
    }): Promise<FiscalProfile>
  }
}

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ")
}

export function normalizeFiscalTaxId(value: string): string {
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "")

  if (!normalized) {
    throw new Error("El NIF fiscal es obligatorio")
  }

  return normalized
}

function assertV1FiscalProfileInput(input: FiscalProfileInput) {
  if ((input.countryCode ?? FISCAL_PROFILE_COUNTRY_CODE) !== FISCAL_PROFILE_COUNTRY_CODE) {
    throw new Error(`FiscalProfile V1 solo admite countryCode=${FISCAL_PROFILE_COUNTRY_CODE}`)
  }

  if ((input.currencyCode ?? FISCAL_PROFILE_CURRENCY_CODE) !== FISCAL_PROFILE_CURRENCY_CODE) {
    throw new Error(`FiscalProfile V1 solo admite currencyCode=${FISCAL_PROFILE_CURRENCY_CODE}`)
  }

  if ((input.legalEntityType ?? FISCAL_PROFILE_LEGAL_ENTITY_TYPE) !== FISCAL_PROFILE_LEGAL_ENTITY_TYPE) {
    throw new Error(`FiscalProfile V1 solo admite legalEntityType=${FISCAL_PROFILE_LEGAL_ENTITY_TYPE}`)
  }
}

function buildFiscalProfileWriteInput(input: FiscalProfileInput) {
  assertV1FiscalProfileInput(input)

  const companyName = collapseWhitespace(input.companyName)

  if (!companyName) {
    throw new Error("El nombre fiscal de la empresa es obligatorio")
  }

  const taxIdNormalized = normalizeFiscalTaxId(input.taxId)
  const annualCloseMonth = input.annualCloseMonth ?? 12

  if (!Number.isInteger(annualCloseMonth) || annualCloseMonth < 1 || annualCloseMonth > 12) {
    throw new Error("FiscalProfile V2 requiere annualCloseMonth entre 1 y 12")
  }

  return {
    companyName,
    taxId: taxIdNormalized,
    taxIdNormalized,
    countryCode: FISCAL_PROFILE_COUNTRY_CODE,
    currencyCode: FISCAL_PROFILE_CURRENCY_CODE,
    legalEntityType: FISCAL_PROFILE_LEGAL_ENTITY_TYPE,
    vatCashAccountingEnabled: input.vatCashAccountingEnabled ?? false,
    hasEmployees: input.hasEmployees ?? false,
    hasRentWithholding: input.hasRentWithholding ?? false,
    hasProfessionalWithholding: input.hasProfessionalWithholding ?? false,
    hasIntraEuOperations: input.hasIntraEuOperations ?? false,
    issuesInvoices: input.issuesInvoices ?? true,
    annualCloseMonth,
  }
}

function buildFiscalProfileWriteInputFromUser(user: FiscalProfileUserRecord) {
  const companyName = collapseWhitespace(user.businessName ?? "")
  const taxId = user.businessTaxId?.trim()

  if (!companyName || !taxId) {
    return null
  }

  return buildFiscalProfileWriteInput({
    companyName,
    taxId,
  })
}

type FiscalProfileDbClient = Pick<PrismaClient, "user" | "fiscalProfile">
type FiscalProfileWriteInput = ReturnType<typeof buildFiscalProfileWriteInput>

export type FiscalProfileAccess =
  | {
      status: "ready"
      profile: FiscalProfile
    }
  | {
      status: "profile_missing"
      profile: null
    }
  | {
      status: "storage_not_ready"
      profile: null
    }

function createFiscalProfileStore(db: FiscalProfileDbClient): FiscalProfileStore {
  return {
    user: {
      findUnique(args) {
        return db.user.findUnique(args)
      },
    },
    fiscalProfile: {
      findUnique(args) {
        return db.fiscalProfile.findUnique(args)
      },
      upsert(args) {
        return db.fiscalProfile.upsert(args)
      },
    },
  }
}

async function resolveStore(store?: FiscalProfileStore): Promise<FiscalProfileStore> {
  if (store) {
    return store
  }

  const { prisma } = await import("../../lib/db.ts")
  return createFiscalProfileStore(prisma)
}

function resolveFiscalProfileOrganizationId(user: FiscalProfileUserRecord | null, userId: string) {
  return user?.defaultOrganizationId ?? userId
}

async function resolveBootstrapUser(userId: string, store?: FiscalProfileStore) {
  const db = await resolveStore(store)
  const user = await db.user.findUnique({
    where: { id: userId },
    select: FISCAL_PROFILE_USER_SELECT,
  })

  return {
    db,
    user,
  }
}

async function ensureFiscalProfileForOrganizationInternal(
  organizationId: string,
  userId: string,
  db: FiscalProfileStore,
  bootstrapUser: FiscalProfileUserRecord | null
) {
  const existing = await db.fiscalProfile.findUnique({
    where: { organizationId },
  })

  if (existing) {
    return existing
  }

  if (!bootstrapUser) {
    return null
  }

  const data = buildFiscalProfileWriteInputFromUser(bootstrapUser)

  if (!data) {
    return null
  }

  return db.fiscalProfile.upsert({
    where: { organizationId },
    update: data,
    create: {
      id: organizationId,
      userId,
      organizationId,
      ...data,
    },
  })
}

export async function ensureFiscalProfileForOrganization(
  organizationId: string,
  userId: string,
  store?: FiscalProfileStore
): Promise<FiscalProfile | null> {
  return withFiscalStorageGuard(async () => {
    const { db, user } = await resolveBootstrapUser(userId, store)
    return await ensureFiscalProfileForOrganizationInternal(organizationId, userId, db, user)
  })
}

export async function ensureFiscalProfileForUser(
  userId: string,
  store?: FiscalProfileStore
): Promise<FiscalProfile | null> {
  return withFiscalStorageGuard(async () => {
    const { db, user } = await resolveBootstrapUser(userId, store)

    if (!user) {
      return null
    }

    return await ensureFiscalProfileForOrganizationInternal(
      resolveFiscalProfileOrganizationId(user, userId),
      userId,
      db,
      user
    )
  })
}

export async function getFiscalProfileAccessByOrganizationId(
  organizationId: string,
  userId: string,
  store?: FiscalProfileStore
): Promise<FiscalProfileAccess> {
  try {
    const profile = await ensureFiscalProfileForOrganization(organizationId, userId, store)

    if (!profile) {
      return {
        status: "profile_missing",
        profile: null,
      }
    }

    return {
      status: "ready",
      profile,
    }
  } catch (error) {
    if (isFiscalStorageNotReadyError(error)) {
      return {
        status: "storage_not_ready",
        profile: null,
      }
    }

    throw error
  }
}

export async function getFiscalProfileAccessByUserId(
  userId: string,
  store?: FiscalProfileStore
): Promise<FiscalProfileAccess> {
  try {
    const profile = await ensureFiscalProfileForUser(userId, store)

    if (!profile) {
      return {
        status: "profile_missing",
        profile: null,
      }
    }

    return {
      status: "ready",
      profile,
    }
  } catch (error) {
    if (isFiscalStorageNotReadyError(error)) {
      return {
        status: "storage_not_ready",
        profile: null,
      }
    }

    throw error
  }
}

export async function getFiscalProfileByOrganizationId(
  organizationId: string,
  userId: string,
  store?: FiscalProfileStore
): Promise<FiscalProfile | null> {
  const access = await getFiscalProfileAccessByOrganizationId(organizationId, userId, store)
  return access.status === "ready" ? access.profile : null
}

export async function getFiscalProfileByUserId(
  userId: string,
  store?: FiscalProfileStore
): Promise<FiscalProfile | null> {
  const access = await getFiscalProfileAccessByUserId(userId, store)
  return access.status === "ready" ? access.profile : null
}

export async function upsertFiscalProfileForOrganization(
  organizationId: string,
  userId: string,
  input: FiscalProfileInput,
  store?: FiscalProfileStore
): Promise<FiscalProfile> {
  return withFiscalStorageGuard(async () => {
    const db = await resolveStore(store)
    const data: FiscalProfileWriteInput = buildFiscalProfileWriteInput(input)

    return db.fiscalProfile.upsert({
      where: { organizationId },
      update: data,
      create: {
        id: organizationId,
        userId,
        organizationId,
        ...data,
      },
    })
  })
}

export async function upsertFiscalProfile(
  userId: string,
  input: FiscalProfileInput,
  store?: FiscalProfileStore
): Promise<FiscalProfile> {
  const { user } = await resolveBootstrapUser(userId, store)
  const organizationId = resolveFiscalProfileOrganizationId(user, userId)
  return upsertFiscalProfileForOrganization(organizationId, userId, input, store)
}
