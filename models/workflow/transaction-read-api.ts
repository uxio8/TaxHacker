import { buildTransactionWorkflowItems } from "./projectors/transactions.ts"
import { buildWorkflowReadModelFromSlices } from "./rebuild.ts"
import type {
  TransactionAttentionSignal,
  TransactionFilters,
  TransactionListItem,
} from "../transactions.ts"
import type { CounterpartyResolution } from "../fiscal/counterparty-resolution.ts"
import type { FiscalProfileAccess } from "../fiscal/profile.ts"
import type { SettingsMap } from "../settings.ts"
import type { TransactionFiscalDocument } from "../fiscal/transaction-fiscal.ts"
import type { Category, Currency, Field, File, Project } from "../../prisma/client"

type TransactionsWorkflowDependencies = {
  getCategories?: (organizationId: string) => Promise<Category[]>
  getProjects?: (organizationId: string) => Promise<Project[]>
  getFields?: (organizationId: string) => Promise<Field[]>
  getTransactions?: (
    organizationId: string,
    filters?: TransactionFilters,
    pagination?: { limit: number; offset: number }
  ) => Promise<{
    transactions: TransactionListItem[]
    total: number
  }>
  getTransactionAttentionSignals?: (
    transaction: TransactionListItem,
    fields: Field[]
  ) => TransactionAttentionSignal[]
}

export type TransactionsWorkflowView = {
  categories: Category[]
  projects: Project[]
  fields: Field[]
  transactions: TransactionListItem[]
  total: number
  attentionByTransactionId: Record<string, TransactionAttentionSignal[]>
  workflow: ReturnType<typeof buildWorkflowReadModelFromSlices<TransactionFilters>>
}

export type FiscalPanelPeriodOption = {
  periodKey: string
  label: string
  status: string | null
}

export type FiscalPanelCounterpartyOption = {
  id: string
  displayName: string
  taxId: string | null
  isActive: boolean
}

export type TransactionWorkflowDetailView = {
  transaction: TransactionListItem
  files: File[]
  categories: Category[]
  currencies: Currency[]
  settings: SettingsMap
  fields: Field[]
  projects: Project[]
  incompleteFields: Field[]
  attentionSignals: TransactionAttentionSignal[]
  fiscalPanel: {
    profileStatus: FiscalProfileAccess["status"]
    document: TransactionFiscalDocument | null
    periodOptions: FiscalPanelPeriodOption[]
    paymentDateLockMessage: string | null
    vatLockMessage: string | null
    withholdingLockMessage: string | null
    counterpartyOptions: FiscalPanelCounterpartyOption[]
    counterpartyResolution: CounterpartyResolution | null
  }
}

type TransactionDetailBaseDependencies = {
  getTransactionById?: (transactionId: string, organizationId: string) => Promise<TransactionListItem | null>
  getFilesByTransactionId?: (transactionId: string, organizationId: string) => Promise<File[]>
  getCategories?: (organizationId: string) => Promise<Category[]>
  getCurrencies?: (organizationId: string) => Promise<Currency[]>
  getSettings?: (organizationId: string) => Promise<SettingsMap>
  getFields?: (organizationId: string) => Promise<Field[]>
  getProjects?: (organizationId: string) => Promise<Project[]>
  getFiscalProfileAccessByOrganizationId?: (
    organizationId: string,
    userId: string
  ) => Promise<FiscalProfileAccess>
  incompleteTransactionFields?: (fields: Field[], transaction: TransactionListItem) => Field[]
  getTransactionAttentionSignals?: (
    transaction: TransactionListItem,
    fields: Field[]
  ) => TransactionAttentionSignal[]
}

type FiscalPeriodLike = {
  periodKey: string
  status: string | null
}

type CounterpartyLike = FiscalPanelCounterpartyOption

type TransactionDetailFiscalDependencies = {
  getTransactionFiscalBySourceTransactionId?: (
    transactionId: string,
    fiscalProfileId: string
  ) => Promise<TransactionFiscalDocument | null>
  syncDefaultSpanishFiscalPeriodsV1?: (
    fiscalProfileId: string,
    input: { referenceDate: Date }
  ) => Promise<FiscalPeriodLike[]>
  getFiscalPeriodByKey?: (
    fiscalProfileId: string,
    periodKey: string
  ) => Promise<{ status: string | null } | null>
  getCounterparties?: (fiscalProfileId: string) => Promise<CounterpartyLike[]>
  resolveCounterpartyResolution?: (input: unknown) => CounterpartyResolution | null
}

type TransactionDetailWorkflowDependencies = TransactionDetailBaseDependencies &
  TransactionDetailFiscalDependencies

async function resolveTransactionsDependencies(
  dependencies: TransactionsWorkflowDependencies
): Promise<Required<TransactionsWorkflowDependencies>> {
  const deps = { ...dependencies }

  if (!deps.getCategories) {
    const categoriesModule = await import("../categories.ts")
    deps.getCategories = categoriesModule.getCategories
  }

  if (!deps.getProjects) {
    const projectsModule = await import("../projects.ts")
    deps.getProjects = projectsModule.getProjects
  }

  if (!deps.getFields || !deps.getTransactions || !deps.getTransactionAttentionSignals) {
    const transactionsModule = await import("../transactions.ts")

    deps.getFields ??= (await import("../fields.ts")).getFields
    deps.getTransactions ??= transactionsModule.getTransactions
    deps.getTransactionAttentionSignals ??= transactionsModule.getTransactionAttentionSignals
  }

  return deps as Required<TransactionsWorkflowDependencies>
}

async function resolveTransactionDetailBaseDependencies(
  dependencies: TransactionDetailBaseDependencies
): Promise<Required<TransactionDetailBaseDependencies>> {
  const deps = { ...dependencies }

  if (!deps.getTransactionById || !deps.getTransactionAttentionSignals) {
    const transactionsModule = await import("../transactions.ts")
    deps.getTransactionById ??= transactionsModule.getTransactionById
    deps.getTransactionAttentionSignals ??= transactionsModule.getTransactionAttentionSignals
  }

  if (!deps.getFilesByTransactionId) {
    deps.getFilesByTransactionId = (await import("../files.ts")).getFilesByTransactionId
  }

  if (!deps.getCategories) {
    deps.getCategories = (await import("../categories.ts")).getCategories
  }

  if (!deps.getCurrencies) {
    deps.getCurrencies = (await import("../currencies.ts")).getCurrencies
  }

  if (!deps.getSettings) {
    deps.getSettings = (await import("../settings.ts")).getSettings
  }

  if (!deps.getFields) {
    deps.getFields = (await import("../fields.ts")).getFields
  }

  if (!deps.getProjects) {
    deps.getProjects = (await import("../projects.ts")).getProjects
  }

  if (!deps.getFiscalProfileAccessByOrganizationId) {
    deps.getFiscalProfileAccessByOrganizationId = (
      await import("../fiscal/profile.ts")
    ).getFiscalProfileAccessByOrganizationId
  }

  if (!deps.incompleteTransactionFields) {
    deps.incompleteTransactionFields = (await import("../../lib/stats.ts")).incompleteTransactionFields
  }

  return deps as Required<TransactionDetailBaseDependencies>
}

async function resolveTransactionDetailFiscalDependencies(
  dependencies: TransactionDetailFiscalDependencies
): Promise<Required<TransactionDetailFiscalDependencies>> {
  const deps = { ...dependencies }

  if (!deps.getTransactionFiscalBySourceTransactionId) {
    deps.getTransactionFiscalBySourceTransactionId = (
      await import("../fiscal/transaction-fiscal.ts")
    ).getTransactionFiscalBySourceTransactionId
  }

  if (!deps.syncDefaultSpanishFiscalPeriodsV1 || !deps.getFiscalPeriodByKey) {
    const periodsModule = await import("../fiscal/periods.ts")
    deps.syncDefaultSpanishFiscalPeriodsV1 ??= periodsModule.syncDefaultSpanishFiscalPeriodsV1
    deps.getFiscalPeriodByKey ??= periodsModule.getFiscalPeriodByKey
  }

  if (!deps.getCounterparties) {
    deps.getCounterparties = (await import("../fiscal/counterparties.ts")).getCounterparties
  }

  if (!deps.resolveCounterpartyResolution) {
    deps.resolveCounterpartyResolution = (
      await import("../fiscal/counterparty-resolution.ts")
    ).resolveCounterpartyResolution as (input: unknown) => CounterpartyResolution | null
  }

  return deps as Required<TransactionDetailFiscalDependencies>
}

function getFiscalPeriodStatusLabel(status: string | null) {
  if (status === "closed") {
    return "cerrado"
  }

  if (status === "presented") {
    return "presentado"
  }

  if (status === "ready") {
    return "listo"
  }

  if (status === "in_review") {
    return "en revisión"
  }

  if (status === "open") {
    return "abierto"
  }

  return "sin estado"
}

function buildFiscalLockMessage(label: string, periods: Array<{ periodKey: string; status: string }>) {
  if (periods.length === 0) {
    return null
  }

  const detail = periods.map((period) => `${period.periodKey} (${getFiscalPeriodStatusLabel(period.status)})`).join(", ")
  return `${label} bloqueado por periodo fiscal: ${detail}.`
}

export async function getTransactionsWorkflowView(
  input: {
    organizationId: string
    filters: Omit<TransactionFilters, "page">
    page: number
    perPage: number
  },
  dependencies: TransactionsWorkflowDependencies = {}
): Promise<TransactionsWorkflowView> {
  const deps = await resolveTransactionsDependencies(dependencies)

  const [categories, projects, fields, transactionResult] = await Promise.all([
    deps.getCategories(input.organizationId),
    deps.getProjects(input.organizationId),
    deps.getFields(input.organizationId),
    deps.getTransactions(input.organizationId, input.filters, {
      limit: input.perPage,
      offset: (input.page - 1) * input.perPage,
    }),
  ])

  const attentionByTransactionId = Object.fromEntries(
    transactionResult.transactions.map((transaction) => [
      transaction.id,
      deps.getTransactionAttentionSignals(transaction, fields),
    ])
  )

  return {
    categories,
    projects,
    fields,
    transactions: transactionResult.transactions,
    total: transactionResult.total,
    attentionByTransactionId,
    workflow: buildWorkflowReadModelFromSlices({
      readiness: input.filters,
      items: buildTransactionWorkflowItems(
        transactionResult.transactions.map((transaction) => ({
          id: transaction.id,
          title: transaction.name ?? transaction.merchant ?? transaction.id,
          href: `/transactions/${transaction.id}`,
          signals: attentionByTransactionId[transaction.id] ?? [],
        }))
      ),
    }),
  }
}

export async function getTransactionWorkflowDetailView(
  input: {
    organizationId: string
    transactionId: string
    userId: string
  },
  dependencies: TransactionDetailWorkflowDependencies = {}
): Promise<TransactionWorkflowDetailView | null> {
  const baseDeps = await resolveTransactionDetailBaseDependencies(dependencies)

  const [transaction, files, categories, currencies, settings, fields, projects, fiscalProfileAccess] =
    await Promise.all([
      baseDeps.getTransactionById(input.transactionId, input.organizationId),
      baseDeps.getFilesByTransactionId(input.transactionId, input.organizationId),
      baseDeps.getCategories(input.organizationId),
      baseDeps.getCurrencies(input.organizationId),
      baseDeps.getSettings(input.organizationId),
      baseDeps.getFields(input.organizationId),
      baseDeps.getProjects(input.organizationId),
      baseDeps.getFiscalProfileAccessByOrganizationId(input.organizationId, input.userId),
    ])

  if (!transaction) {
    return null
  }

  const incompleteFields = baseDeps.incompleteTransactionFields(fields, transaction)
  const attentionSignals = baseDeps.getTransactionAttentionSignals(transaction, fields)

  const fiscalPanel: TransactionWorkflowDetailView["fiscalPanel"] = {
    profileStatus: fiscalProfileAccess.status,
    document: null,
    periodOptions: [],
    paymentDateLockMessage: null,
    vatLockMessage: null,
    withholdingLockMessage: null,
    counterpartyOptions: [],
    counterpartyResolution: null,
  }

  if (fiscalProfileAccess.status === "ready") {
    const fiscalDeps = await resolveTransactionDetailFiscalDependencies(dependencies)
    const referenceDate = transaction.issuedAt ?? new Date()
    const [document, periods, counterparties] = await Promise.all([
      fiscalDeps.getTransactionFiscalBySourceTransactionId(input.transactionId, fiscalProfileAccess.profile.id),
      fiscalDeps.syncDefaultSpanishFiscalPeriodsV1(fiscalProfileAccess.profile.id, { referenceDate }),
      fiscalDeps.getCounterparties(fiscalProfileAccess.profile.id),
    ])

    fiscalPanel.document = document
    fiscalPanel.counterpartyOptions = counterparties.map((counterparty) => ({
      id: counterparty.id,
      displayName: counterparty.displayName,
      taxId: counterparty.taxId,
      isActive: counterparty.isActive,
    }))

    const periodMap = new Map<string, FiscalPanelPeriodOption>(
      periods.map((period) => [
        period.periodKey,
        {
          periodKey: period.periodKey,
          label: `${period.periodKey} · ${getFiscalPeriodStatusLabel(period.status)}`,
          status: period.status,
        },
      ])
    )

    for (const assignment of [
      document?.header.vat_period_assignment,
      document?.header.withholding_period_assignment,
    ]) {
      if (assignment?.period_key && !periodMap.has(assignment.period_key)) {
        const period = await fiscalDeps.getFiscalPeriodByKey(
          fiscalProfileAccess.profile.id,
          assignment.period_key
        )

        periodMap.set(assignment.period_key, {
          periodKey: assignment.period_key,
          label: `${assignment.period_key} · ${getFiscalPeriodStatusLabel(period?.status ?? null)}`,
          status: period?.status ?? null,
        })
      }
    }

    fiscalPanel.periodOptions = [...periodMap.values()].sort((left, right) =>
      right.periodKey.localeCompare(left.periodKey)
    )

    if (document) {
      if (!document.header.counterparty_id) {
        fiscalPanel.counterpartyResolution = fiscalDeps.resolveCounterpartyResolution({
          ownerScopeId: fiscalProfileAccess.profile.id,
          document: {
            fiscal_document_id: document.header.fiscal_document_id,
            source_transaction_id: document.header.source_transaction_id,
            document_kind: document.header.document_kind,
            counterparty_id: document.header.counterparty_id,
            counterparty_name: document.header.counterparty_name,
            counterparty_tax_id: document.header.counterparty_tax_id,
            counterparty_role: document.header.counterparty_role,
            issue_date: document.header.issue_date,
            total_payable_cents: document.header.total_payable_cents,
            total_vat_cents: document.header.total_vat_cents,
            total_withholding_cents: document.header.total_withholding_cents,
          },
          counterparties,
        })
      }

      const uniqueAffectedKeys = [
        document.header.vat_period_assignment?.period_key,
        document.header.withholding_period_assignment?.period_key,
      ].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index)

      const protectedPeriods = (
        await Promise.all(
          uniqueAffectedKeys.map(async (periodKey) => {
            const period = await fiscalDeps.getFiscalPeriodByKey(fiscalProfileAccess.profile.id, periodKey)

            if (!period || (period.status !== "closed" && period.status !== "presented")) {
              return null
            }

            return {
              periodKey,
              status: period.status,
            }
          })
        )
      ).filter((period): period is { periodKey: string; status: "closed" | "presented" } => period !== null)

      fiscalPanel.paymentDateLockMessage = buildFiscalLockMessage(
        "Edición de payment_date",
        protectedPeriods
      )
      fiscalPanel.vatLockMessage = buildFiscalLockMessage(
        "Override de IVA",
        protectedPeriods.filter(
          (period) => period.periodKey === document.header.vat_period_assignment?.period_key
        )
      )
      fiscalPanel.withholdingLockMessage = buildFiscalLockMessage(
        "Override de retenciones",
        protectedPeriods.filter(
          (period) => period.periodKey === document.header.withholding_period_assignment?.period_key
        )
      )
    }
  }

  return {
    transaction,
    files,
    categories,
    currencies,
    settings,
    fields,
    projects,
    incompleteFields,
    attentionSignals,
    fiscalPanel,
  }
}
