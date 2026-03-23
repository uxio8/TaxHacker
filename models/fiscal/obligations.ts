import type { FiscalObligation, FiscalProfile } from "../../prisma/client/index.js"
import { withFiscalStorageGuard } from "./storage.ts"

export const FISCAL_OBLIGATION_CODES = [
  "303",
  "115",
  "111_manual",
  "180",
  "390",
  "347",
  "349",
  "200_handoff",
  "202_handoff",
  "annual_accounts",
  "book_legalization",
  "mercantile_filing",
] as const

export const FISCAL_OBLIGATION_STATUSES = [
  "not_applicable",
  "waiting_on_documents",
  "needs_review",
  "ready_to_prepare",
  "draft_ready",
  "ready_to_file",
  "filed",
  "archived",
] as const

export const FISCAL_OBLIGATION_OWNERS = ["client", "advisor", "shared", "system"] as const

export type FiscalObligationCode = (typeof FISCAL_OBLIGATION_CODES)[number]
export type FiscalObligationStatus = (typeof FISCAL_OBLIGATION_STATUSES)[number]
export type FiscalObligationOwner = (typeof FISCAL_OBLIGATION_OWNERS)[number]

type FiscalProfileLike = Pick<
  FiscalProfile,
  | "id"
  | "organizationId"
  | "hasEmployees"
  | "hasRentWithholding"
  | "hasProfessionalWithholding"
  | "hasIntraEuOperations"
  | "issuesInvoices"
  | "annualCloseMonth"
>

type QuarterlyDraftLike = {
  period: {
    fiscalYear: number
    quarter: number
    periodKey: string
    status: string
  }
  operationalStatus: {
    code: string
    reviewDocumentCount: number
    blockingDocumentCount: number
  }
  totals: {
    model303DocumentCount: number
    model115DocumentCount: number
  }
}

type FiscalObligationRecord = Pick<
  FiscalObligation,
  | "organizationId"
  | "ownerScopeId"
  | "code"
  | "fiscalYear"
  | "quarter"
  | "periodKey"
  | "status"
  | "dueDate"
  | "owner"
  | "blockingReasons"
  | "requiredEvidence"
  | "filingReference"
  | "filedAt"
  | "notes"
> & {
  filedByUserId: string | null
}

type FiscalObligationDetailRecord = FiscalObligationRecord & Pick<FiscalObligation, "id">

type FiscalObligationStore = {
  fiscalProfile: {
    findUnique(args: { where: { organizationId: string } }): Promise<FiscalProfileLike | null>
  }
  fiscalPeriod: {
    findMany(args: {
      where: { ownerScopeId: string }
      orderBy: Array<Record<string, "asc" | "desc">>
    }): Promise<
      Array<{
        fiscalYear: number
        quarter: number
        periodKey: string
        status: string
      }>
    >
  }
  fiscalObligation: {
    findMany(args: {
      where: { organizationId: string }
    }): Promise<FiscalObligationDetailRecord[]>
    findUnique(args: {
      where: {
        organizationId_code_periodKey: {
          organizationId: string
          code: string
          periodKey: string
        }
      }
    }): Promise<FiscalObligationDetailRecord | null>
    upsert(args: {
      where: {
        organizationId_code_periodKey: {
          organizationId: string
          code: string
          periodKey: string
        }
      }
      update: Omit<FiscalObligationRecord, "organizationId" | "ownerScopeId" | "code" | "periodKey" | "fiscalYear">
      create: FiscalObligationRecord
    }): Promise<FiscalObligation>
    update(args: {
      where: {
        organizationId_code_periodKey: {
          organizationId: string
          code: string
          periodKey: string
        }
      }
      data: {
        status: string
        owner?: string
        filingReference?: string | null
        filedAt?: Date | null
        filedByUserId?: string | null
        notes?: string | null
      }
    }): Promise<FiscalObligation>
  }
}

export type FiscalObligationDetail = FiscalObligationDetailRecord

function makeUtcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day))
}

function getLastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function addMonths(year: number, month: number, delta: number) {
  const normalizedMonthIndex = month - 1 + delta
  const nextYear = year + Math.floor(normalizedMonthIndex / 12)
  const nextMonth = (normalizedMonthIndex % 12 + 12) % 12 + 1
  return {
    year: nextYear,
    month: nextMonth,
  }
}

function buildEndOfMonthDueDate(fiscalYear: number, annualCloseMonth: number, monthsAfterClose: number) {
  const { year, month } = addMonths(fiscalYear, annualCloseMonth, monthsAfterClose)
  return makeUtcDate(year, month, getLastDayOfMonth(year, month))
}

function buildQuarterDueDate(code: FiscalObligationCode, fiscalYear: number, quarter: number) {
  if (code === "303") {
    if (quarter === 1) return makeUtcDate(fiscalYear, 4, 20)
    if (quarter === 2) return makeUtcDate(fiscalYear, 7, 20)
    if (quarter === 3) return makeUtcDate(fiscalYear, 10, 20)
    return makeUtcDate(fiscalYear + 1, 1, 30)
  }

  if (code === "115" || code === "111_manual") {
    if (quarter === 1) return makeUtcDate(fiscalYear, 4, 20)
    if (quarter === 2) return makeUtcDate(fiscalYear, 7, 20)
    if (quarter === 3) return makeUtcDate(fiscalYear, 10, 20)
    return makeUtcDate(fiscalYear + 1, 1, 20)
  }

  return null
}

function buildAnnualDueDate(
  code: FiscalObligationCode,
  fiscalYear: number,
  annualCloseMonth: number
) {
  if (code === "180" || code === "390" || code === "349") {
    return makeUtcDate(fiscalYear + 1, 1, 30)
  }

  if (code === "347") {
    return makeUtcDate(fiscalYear + 1, 2, 28)
  }

  if (code === "200_handoff") {
    return makeUtcDate(fiscalYear + 1, 7, 25)
  }

  if (code === "202_handoff") {
    return makeUtcDate(fiscalYear, 12, 20)
  }

  if (code === "annual_accounts") {
    return buildEndOfMonthDueDate(fiscalYear, annualCloseMonth, 3)
  }

  if (code === "book_legalization") {
    return buildEndOfMonthDueDate(fiscalYear, annualCloseMonth, 4)
  }

  if (code === "mercantile_filing") {
    return buildEndOfMonthDueDate(fiscalYear, annualCloseMonth, 7)
  }

  return null
}

function createQuarterlyStatus(
  code: FiscalObligationCode,
  draft: QuarterlyDraftLike,
  applies: boolean
): FiscalObligationStatus {
  if (!applies) {
    return "not_applicable"
  }

  if (draft.period.status === "closed") {
    return "archived"
  }

  if (draft.period.status === "presented") {
    return "filed"
  }

  if (code === "111_manual") {
    return "waiting_on_documents"
  }

  if (draft.operationalStatus.blockingDocumentCount > 0 || draft.operationalStatus.reviewDocumentCount > 0) {
    return "needs_review"
  }

  const relevantDocumentCount =
    code === "303" ? draft.totals.model303DocumentCount : draft.totals.model115DocumentCount

  if (relevantDocumentCount > 0) {
    return "ready_to_prepare"
  }

  return "waiting_on_documents"
}

function createAnnualStatus(applies: boolean): FiscalObligationStatus {
  return applies ? "waiting_on_documents" : "not_applicable"
}

function getRequiredEvidence(code: FiscalObligationCode) {
  if (code === "303") {
    return ["source_documents", "vat_breakdown", "draft_export", "filing_receipt"]
  }

  if (code === "115" || code === "180") {
    return ["source_documents", "counterparty_tax_id", "rent_contract", "filing_receipt"]
  }

  if (code === "111_manual") {
    return ["external_payroll_summary", "filing_receipt"]
  }

  if (code === "347" || code === "349") {
    return ["counterparty_tax_id", "source_documents", "filing_receipt"]
  }

  if (code === "annual_accounts") {
    return ["trial_balance", "annual_accounts_draft", "supporting_documents"]
  }

  if (code === "book_legalization") {
    return ["ledger_export", "inventory_book", "minutes_book"]
  }

  if (code === "mercantile_filing") {
    return ["annual_accounts_signed", "shareholder_approval", "deposit_receipt"]
  }

  return ["draft_export", "filing_receipt"]
}

function getDefaultOwner(status: FiscalObligationStatus): FiscalObligationOwner {
  if (status === "not_applicable") {
    return "system"
  }

  return "advisor"
}

function buildQuarterlyObligation(
  profile: FiscalProfileLike,
  draft: QuarterlyDraftLike,
  code: FiscalObligationCode,
  applies: boolean
): FiscalObligationRecord {
  const status = createQuarterlyStatus(code, draft, applies)

  return {
    organizationId: profile.organizationId,
    ownerScopeId: profile.id,
    code,
    fiscalYear: draft.period.fiscalYear,
    quarter: draft.period.quarter,
    periodKey: draft.period.periodKey,
    status,
    dueDate: buildQuarterDueDate(code, draft.period.fiscalYear, draft.period.quarter),
    owner: getDefaultOwner(status),
    blockingReasons: [],
    requiredEvidence: getRequiredEvidence(code),
    filingReference: null,
    filedAt: null,
    filedByUserId: null,
    notes: null,
  }
}

function buildAnnualObligation(
  profile: FiscalProfileLike,
  fiscalYear: number,
  code: FiscalObligationCode,
  applies: boolean
): FiscalObligationRecord {
  const status = createAnnualStatus(applies)

  return {
    organizationId: profile.organizationId,
    ownerScopeId: profile.id,
    code,
    fiscalYear,
    quarter: null,
    periodKey: `${fiscalYear}-Y`,
    status,
    dueDate: buildAnnualDueDate(code, fiscalYear, profile.annualCloseMonth),
    owner: getDefaultOwner(status),
    blockingReasons: [],
    requiredEvidence: getRequiredEvidence(code),
    filingReference: null,
    filedAt: null,
    filedByUserId: null,
    notes: null,
  }
}

function buildObligationMapKey(input: {
  organizationId: string
  code: string
  periodKey: string
}) {
  return `${input.organizationId}:${input.code}:${input.periodKey}`
}

function shouldPreserveManualStatus(
  existing: FiscalObligationRecord | undefined,
  next: FiscalObligationRecord
) {
  if (!existing || next.status === "not_applicable") {
    return false
  }

  if (next.quarter === null) {
    return true
  }

  return (
    existing.status === "draft_ready"
    || existing.status === "ready_to_file"
    || existing.status === "filed"
    || existing.status === "archived"
  )
}

function mergeExistingObligationState(
  next: FiscalObligationRecord,
  existing: FiscalObligationRecord | undefined
): FiscalObligationRecord {
  if (!existing) {
    return next
  }

  return {
    ...next,
    status: shouldPreserveManualStatus(existing, next) ? existing.status : next.status,
    owner: existing.owner || next.owner,
    blockingReasons:
      Array.isArray(existing.blockingReasons) && existing.blockingReasons.length > 0
        ? existing.blockingReasons
        : next.blockingReasons,
    filingReference: existing.filingReference ?? next.filingReference,
    filedAt: existing.filedAt ?? next.filedAt,
    filedByUserId: existing.filedByUserId ?? next.filedByUserId,
    notes: existing.notes ?? next.notes,
  }
}

export function buildFiscalObligations({
  profile,
  drafts,
}: {
  profile: FiscalProfileLike
  drafts: QuarterlyDraftLike[]
}): FiscalObligationRecord[] {
  const obligations: FiscalObligationRecord[] = []

  for (const draft of drafts) {
    obligations.push(buildQuarterlyObligation(profile, draft, "303", true))
    obligations.push(
      buildQuarterlyObligation(profile, draft, "115", profile.hasRentWithholding)
    )
    obligations.push(
      buildQuarterlyObligation(
        profile,
        draft,
        "111_manual",
        profile.hasEmployees || profile.hasProfessionalWithholding
      )
    )
  }

  const fiscalYears = [...new Set(drafts.map((draft) => draft.period.fiscalYear))].sort()

  for (const fiscalYear of fiscalYears) {
    obligations.push(buildAnnualObligation(profile, fiscalYear, "180", profile.hasRentWithholding))
    obligations.push(buildAnnualObligation(profile, fiscalYear, "390", true))
    obligations.push(buildAnnualObligation(profile, fiscalYear, "347", true))
    obligations.push(buildAnnualObligation(profile, fiscalYear, "349", profile.hasIntraEuOperations))
    obligations.push(buildAnnualObligation(profile, fiscalYear, "200_handoff", true))
    obligations.push(buildAnnualObligation(profile, fiscalYear, "202_handoff", true))
    obligations.push(buildAnnualObligation(profile, fiscalYear, "annual_accounts", true))
    obligations.push(buildAnnualObligation(profile, fiscalYear, "book_legalization", true))
    obligations.push(buildAnnualObligation(profile, fiscalYear, "mercantile_filing", true))
  }

  return obligations
}

function mapPeriodToDraft(period: {
  fiscalYear: number
  quarter: number
  periodKey: string
  status: string
}): QuarterlyDraftLike {
  return {
    period: {
      fiscalYear: period.fiscalYear,
      quarter: period.quarter,
      periodKey: period.periodKey,
      status: period.status,
    },
    operationalStatus: {
      code: "open",
      reviewDocumentCount: 0,
      blockingDocumentCount: 0,
    },
    totals: {
      model303DocumentCount: 0,
      model115DocumentCount: 0,
    },
  }
}

async function resolveStore(store?: FiscalObligationStore): Promise<FiscalObligationStore> {
  if (store) {
    return store
  }

  const { prisma } = await import("../../lib/db.ts")
  return prisma as unknown as FiscalObligationStore
}

export async function syncFiscalObligationsForOrganization(
  organizationId: string,
  store?: FiscalObligationStore
): Promise<FiscalObligation[]> {
  return withFiscalStorageGuard(async () => {
    const db = await resolveStore(store)
    const profile = await db.fiscalProfile.findUnique({
      where: { organizationId },
    })

    if (!profile) {
      return []
    }

    const periods = await db.fiscalPeriod.findMany({
      where: { ownerScopeId: profile.id },
      orderBy: [{ fiscalYear: "desc" }, { quarter: "desc" }],
    })

    const obligations = buildFiscalObligations({
      profile,
      drafts: periods.map(mapPeriodToDraft),
    })
    const existingObligations = await db.fiscalObligation.findMany({
      where: { organizationId },
    })
    const existingObligationsByKey = new Map(
      existingObligations.map((obligation) => [
        buildObligationMapKey({
          organizationId: obligation.organizationId,
          code: obligation.code,
          periodKey: obligation.periodKey,
        }),
        obligation,
      ])
    )

    return Promise.all(
      obligations.map((obligation) => {
        const mergedObligation = mergeExistingObligationState(
          obligation,
          existingObligationsByKey.get(
            buildObligationMapKey({
              organizationId: obligation.organizationId,
              code: obligation.code,
              periodKey: obligation.periodKey,
            })
          )
        )

        return (
        db.fiscalObligation.upsert({
          where: {
            organizationId_code_periodKey: {
              organizationId: mergedObligation.organizationId,
              code: mergedObligation.code,
              periodKey: mergedObligation.periodKey,
            },
          },
          update: {
            quarter: mergedObligation.quarter,
            status: mergedObligation.status,
            dueDate: mergedObligation.dueDate,
            owner: mergedObligation.owner,
            blockingReasons: mergedObligation.blockingReasons,
            requiredEvidence: mergedObligation.requiredEvidence,
            filingReference: mergedObligation.filingReference,
            filedAt: mergedObligation.filedAt,
            filedByUserId: mergedObligation.filedByUserId,
            notes: mergedObligation.notes,
          },
          create: mergedObligation,
        })
        )
      })
    )
  })
}

export async function getFiscalObligationByCodeAndPeriod(
  organizationId: string,
  code: FiscalObligationCode,
  periodKey: string,
  store?: FiscalObligationStore
) {
  return withFiscalStorageGuard(async () => {
    const db = await resolveStore(store)

    return db.fiscalObligation.findUnique({
      where: {
        organizationId_code_periodKey: {
          organizationId,
          code,
          periodKey,
        },
      },
    })
  })
}

export async function updateFiscalObligationFilingState(
  input: {
    organizationId: string
    code: FiscalObligationCode
    periodKey: string
    status: "draft_ready" | "ready_to_file" | "filed"
    filingReference?: string | null
    filedAt?: Date | null
    filedByUserId?: string | null
    notes?: string | null
  },
  store?: FiscalObligationStore
) {
  return withFiscalStorageGuard(async () => {
    const db = await resolveStore(store)

    return db.fiscalObligation.update({
      where: {
        organizationId_code_periodKey: {
          organizationId: input.organizationId,
          code: input.code,
          periodKey: input.periodKey,
        },
      },
      data: {
        status: input.status,
        filingReference: input.filingReference?.trim() || null,
        filedAt: input.filedAt ?? null,
        filedByUserId: input.filedByUserId?.trim() || null,
        notes: input.notes?.trim() || null,
      },
    })
  })
}

export async function updateFiscalObligationOperationalState(
  input: {
    organizationId: string
    code: FiscalObligationCode
    periodKey: string
    status: FiscalObligationStatus
    owner?: FiscalObligationOwner | null
    filedAt?: Date | null
    filedByUserId?: string | null
    notes?: string | null
  },
  store?: FiscalObligationStore
) {
  return withFiscalStorageGuard(async () => {
    const db = await resolveStore(store)
    const data: {
      status: FiscalObligationStatus
      owner?: FiscalObligationOwner
      filedAt?: Date | null
      filedByUserId?: string | null
      notes?: string | null
    } = {
      status: input.status,
      filedAt: input.filedAt ?? null,
      filedByUserId: input.filedByUserId?.trim() || null,
      notes: input.notes?.trim() || null,
    }

    if (input.owner) {
      data.owner = input.owner
    }

    return db.fiscalObligation.update({
      where: {
        organizationId_code_periodKey: {
          organizationId: input.organizationId,
          code: input.code,
          periodKey: input.periodKey,
        },
      },
      data,
    })
  })
}
