import { withFiscalStorageGuard } from "./storage.ts"

type FiscalFilingDossierRecord = {
  id: string
  fiscalObligationId: string
  draftSnapshot: unknown
  evidenceManifest: unknown
  checklistState: unknown
  filingReference: string | null
  filedAt: Date | null
  filedByUserId: string | null
  filingReceiptFileId: string | null
  filingNotes: string | null
  createdAt: Date
  updatedAt: Date
}

type FiscalFilingDossierStore = {
  fiscalFilingDossier: {
    findUnique(args: {
      where: {
        fiscalObligationId: string
      }
    }): Promise<FiscalFilingDossierRecord | null>
    upsert(args: {
      where: {
        fiscalObligationId: string
      }
      update: {
        draftSnapshot: unknown
        evidenceManifest: unknown
        checklistState: unknown
        filingReference: string | null
        filedAt: Date | null
        filedByUserId: string | null
        filingReceiptFileId: string | null
        filingNotes: string | null
      }
      create: {
        fiscalObligationId: string
        draftSnapshot: unknown
        evidenceManifest: unknown
        checklistState: unknown
        filingReference: string | null
        filedAt: Date | null
        filedByUserId: string | null
        filingReceiptFileId: string | null
        filingNotes: string | null
      }
    }): Promise<FiscalFilingDossierRecord>
  }
}

export type FiscalFilingDossierInput = {
  fiscalObligationId: string
  draftSnapshot?: unknown
  evidenceManifest?: unknown
  checklistState?: unknown
  filingReference?: string | null
  filedAt?: string | Date | null
  filedByUserId?: string | null
  filingReceiptFileId?: string | null
  filingNotes?: string | null
}

export type FiscalFilingDossier = {
  id: string
  fiscalObligationId: string
  draftSnapshot: unknown
  evidenceManifest: unknown
  checklistState: unknown
  filingReference: string | null
  filedAt: string | null
  filedByUserId: string | null
  filingReceiptFileId: string | null
  filingNotes: string | null
  createdAt: string
  updatedAt: string
}

function trimToNull(value?: string | null) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function parseOptionalDate(value?: string | Date | null) {
  if (!value) {
    return null
  }

  const parsed = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("filedAt debe ser una fecha valida")
  }

  return parsed
}

function normalizeJson(value: unknown) {
  return value ?? {}
}

function mapRecord(record: FiscalFilingDossierRecord): FiscalFilingDossier {
  return {
    id: record.id,
    fiscalObligationId: record.fiscalObligationId,
    draftSnapshot: record.draftSnapshot,
    evidenceManifest: record.evidenceManifest,
    checklistState: record.checklistState,
    filingReference: record.filingReference,
    filedAt: record.filedAt?.toISOString() ?? null,
    filedByUserId: record.filedByUserId,
    filingReceiptFileId: record.filingReceiptFileId,
    filingNotes: record.filingNotes,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

async function resolveStore(store?: FiscalFilingDossierStore): Promise<FiscalFilingDossierStore> {
  if (store) {
    return store
  }

  const { prisma } = await import("../../lib/db.ts")
  return prisma as unknown as FiscalFilingDossierStore
}

function buildWriteInput(input: FiscalFilingDossierInput) {
  const fiscalObligationId = trimToNull(input.fiscalObligationId)

  if (!fiscalObligationId) {
    throw new Error("fiscalObligationId es obligatorio para persistir el expediente fiscal")
  }

  return {
    fiscalObligationId,
    draftSnapshot: normalizeJson(input.draftSnapshot),
    evidenceManifest: normalizeJson(input.evidenceManifest),
    checklistState: normalizeJson(input.checklistState),
    filingReference: trimToNull(input.filingReference),
    filedAt: parseOptionalDate(input.filedAt),
    filedByUserId: trimToNull(input.filedByUserId),
    filingReceiptFileId: trimToNull(input.filingReceiptFileId),
    filingNotes: trimToNull(input.filingNotes),
  }
}

export async function getFiscalFilingDossierByObligationId(
  fiscalObligationId: string,
  store?: FiscalFilingDossierStore
): Promise<FiscalFilingDossier | null> {
  return withFiscalStorageGuard(async () => {
    const normalizedFiscalObligationId = trimToNull(fiscalObligationId)

    if (!normalizedFiscalObligationId) {
      throw new Error("fiscalObligationId es obligatorio para leer el expediente fiscal")
    }

    const db = await resolveStore(store)
    const record = await db.fiscalFilingDossier.findUnique({
      where: {
        fiscalObligationId: normalizedFiscalObligationId,
      },
    })

    return record ? mapRecord(record) : null
  })
}

export async function upsertFiscalFilingDossier(
  input: FiscalFilingDossierInput,
  store?: FiscalFilingDossierStore
): Promise<FiscalFilingDossier> {
  return withFiscalStorageGuard(async () => {
    const db = await resolveStore(store)
    const writeInput = buildWriteInput(input)
    const record = await db.fiscalFilingDossier.upsert({
      where: {
        fiscalObligationId: writeInput.fiscalObligationId,
      },
      update: {
        draftSnapshot: writeInput.draftSnapshot,
        evidenceManifest: writeInput.evidenceManifest,
        checklistState: writeInput.checklistState,
        filingReference: writeInput.filingReference,
        filedAt: writeInput.filedAt,
        filedByUserId: writeInput.filedByUserId,
        filingReceiptFileId: writeInput.filingReceiptFileId,
        filingNotes: writeInput.filingNotes,
      },
      create: writeInput,
    })

    return mapRecord(record)
  })
}
