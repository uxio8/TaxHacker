import type { FiscalObligation, FiscalProfile } from "../../prisma/client/index.js"
import { syncFiscalObligationsForOrganization } from "./obligations.ts"

type AnnualProfile = Pick<FiscalProfile, "annualCloseMonth" | "companyName" | "taxId" | "organizationId">
type AnnualObligation = Pick<
  FiscalObligation,
  "code" | "status" | "owner" | "dueDate" | "requiredEvidence" | "blockingReasons" | "notes"
>

export type AnnualHandoffItemCode =
  | "202_handoff"
  | "book_legalization"
  | "annual_accounts"
  | "200_handoff"
  | "mercantile_filing"

export type AnnualHandoffItem = {
  code: AnnualHandoffItemCode
  title: string
  kind: "tax" | "mercantile"
  status: string
  owner: string
  dueDate: string
  requiredEvidence: string[]
  blockingReasons: string[]
  notes: string
  trackingNotes: string | null
}

export type AnnualHandoffPack = {
  fiscalYear: number
  periodKey: string
  automationMode: "handoff_only"
  companyName: string
  taxId: string
  summary: {
    totalItems: number
    readyOrFiledItems: number
    blockedItems: number
  }
  items: AnnualHandoffItem[]
}

type AnnualHandoffStore = {
  fiscalObligation: {
    findMany(args: {
      where: {
        organizationId: string
        fiscalYear: number
        code: {
          in: string[]
        }
      }
      orderBy: Array<Record<string, "asc" | "desc">>
    }): Promise<AnnualObligation[]>
  }
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

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

function buildModel200FallbackDueDate(fiscalYear: number, annualCloseMonth: number) {
  const { year, month } = addMonths(fiscalYear, annualCloseMonth, 7)
  return makeUtcDate(year, month, 25)
}

function findObligation(code: string, obligations: AnnualObligation[]) {
  return obligations.find((obligation) => obligation.code === code) ?? null
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
}

function buildItemFromObligation(input: {
  code: AnnualHandoffItemCode
  title: string
  kind: "tax" | "mercantile"
  fallbackDueDate: Date
  obligations: AnnualObligation[]
  requiredEvidence: string[]
  notes: string
}): AnnualHandoffItem {
  const obligation = findObligation(input.code, input.obligations)

  return {
    code: input.code,
    title: input.title,
    kind: input.kind,
    status: obligation?.status ?? "waiting_on_documents",
    owner: obligation?.owner ?? "advisor",
    dueDate: formatDateOnly(obligation?.dueDate ?? input.fallbackDueDate),
    requiredEvidence:
      normalizeStringArray(obligation?.requiredEvidence).length > 0
        ? normalizeStringArray(obligation?.requiredEvidence)
        : input.requiredEvidence,
    blockingReasons: normalizeStringArray(obligation?.blockingReasons),
    notes: input.notes,
    trackingNotes: typeof obligation?.notes === "string" && obligation.notes.trim().length > 0 ? obligation.notes : null,
  }
}

export function resolveAnnualHandoffFiscalYear(input: {
  annualCloseMonth: number
  referenceDate?: Date
}) {
  const referenceDate = input.referenceDate ?? new Date()
  const month = referenceDate.getUTCMonth() + 1
  const year = referenceDate.getUTCFullYear()

  return month > input.annualCloseMonth ? year : year - 1
}

export function buildAnnualHandoffPack(input: {
  fiscalYear: number
  profile: AnnualProfile
  obligations: AnnualObligation[]
}): AnnualHandoffPack {
  const annualAccountsDueDate = buildEndOfMonthDueDate(
    input.fiscalYear,
    input.profile.annualCloseMonth,
    3
  )
  const bookLegalizationDueDate = buildEndOfMonthDueDate(
    input.fiscalYear,
    input.profile.annualCloseMonth,
    4
  )
  const mercantileFilingDueDate = buildEndOfMonthDueDate(
    input.fiscalYear,
    input.profile.annualCloseMonth,
    7
  )

  const items: AnnualHandoffItem[] = [
    buildItemFromObligation({
      code: "202_handoff",
      title: "Pagos fraccionados",
      kind: "tax",
      fallbackDueDate: makeUtcDate(input.fiscalYear, 12, 20),
      obligations: input.obligations,
      requiredEvidence: ["draft_export"],
      notes: "Seguimiento anual y handoff a contabilidad o asesoria externa. Sin calculo automatico.",
    }),
    buildItemFromObligation({
      code: "book_legalization",
      title: "Legalizacion de libros",
      kind: "mercantile",
      fallbackDueDate: bookLegalizationDueDate,
      obligations: input.obligations,
      requiredEvidence: ["ledger_export", "inventory_book", "minutes_book"],
      notes: "Checklist mercantil para preparar la legalizacion fuera de TaxHacker.",
    }),
    buildItemFromObligation({
      code: "annual_accounts",
      title: "Cuentas anuales",
      kind: "mercantile",
      fallbackDueDate: annualAccountsDueDate,
      obligations: input.obligations,
      requiredEvidence: ["trial_balance", "annual_accounts_draft", "supporting_documents"],
      notes: "Handoff anual a contabilidad o asesoria. Sin formulacion automatica dentro de la app.",
    }),
    buildItemFromObligation({
      code: "200_handoff",
      title: "Impuesto sobre Sociedades",
      kind: "tax",
      fallbackDueDate: buildModel200FallbackDueDate(
        input.fiscalYear,
        input.profile.annualCloseMonth
      ),
      obligations: input.obligations,
      requiredEvidence: ["draft_export", "filing_receipt"],
      notes: "Seguimiento anual y handoff a contabilidad o asesoria externa. Sin calculo automatico.",
    }),
    buildItemFromObligation({
      code: "mercantile_filing",
      title: "Deposito de cuentas",
      kind: "mercantile",
      fallbackDueDate: mercantileFilingDueDate,
      obligations: input.obligations,
      requiredEvidence: ["annual_accounts_signed", "shareholder_approval", "deposit_receipt"],
      notes: "Seguimiento mercantil del deposito, sin presentacion automatica dentro de TaxHacker.",
    }),
  ].sort((left, right) => left.dueDate.localeCompare(right.dueDate))

  return {
    fiscalYear: input.fiscalYear,
    periodKey: `${input.fiscalYear}-Y`,
    automationMode: "handoff_only",
    companyName: input.profile.companyName,
    taxId: input.profile.taxId,
    summary: {
      totalItems: items.length,
      readyOrFiledItems: items.filter((item) =>
        ["draft_ready", "ready_to_file", "filed", "archived"].includes(item.status)
      ).length,
      blockedItems: items.filter((item) => item.blockingReasons.length > 0).length,
    },
    items,
  }
}

async function resolveStore(store?: AnnualHandoffStore): Promise<AnnualHandoffStore> {
  if (store) {
    return store
  }

  const { prisma } = await import("../../lib/db.ts")
  return prisma as unknown as AnnualHandoffStore
}

export async function getAnnualHandoffPackForOrganization(input: {
  organizationId: string
  profile: AnnualProfile
  fiscalYear: number
  store?: AnnualHandoffStore
}) {
  await syncFiscalObligationsForOrganization(input.organizationId)
  const db = await resolveStore(input.store)
  const obligations = await db.fiscalObligation.findMany({
    where: {
      organizationId: input.organizationId,
      fiscalYear: input.fiscalYear,
      code: {
        in: [
          "200_handoff",
          "202_handoff",
          "annual_accounts",
          "book_legalization",
          "mercantile_filing",
        ],
      },
    },
    orderBy: [{ dueDate: "asc" }, { code: "asc" }],
  })

  return buildAnnualHandoffPack({
    fiscalYear: input.fiscalYear,
    profile: input.profile,
    obligations,
  })
}
