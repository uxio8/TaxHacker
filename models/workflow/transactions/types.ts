import type {
  CounterpartyResolution,
  CounterpartyResolutionCounterpartyInput,
} from "../../fiscal/counterparty-resolution.ts"
import type { FiscalProfileAccess } from "../../fiscal/profile.ts"
import type { TransactionFiscalDocument } from "../../fiscal/transaction-fiscal.ts"
import type { SettingsMap } from "../../settings.ts"
import type {
  TransactionAttentionSignal,
  TransactionFilters,
  TransactionListItem,
} from "../../transactions.ts"
import type { WorkflowReadModel } from "../contracts.ts"
import type { Category, Currency, Field, File, Project } from "../../../prisma/client"

export type TransactionsWorkflowDependencies = {
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
  workflow: WorkflowReadModel<Omit<TransactionFilters, "page">>
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

export type TransactionDetailBaseDependencies = {
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

export type FiscalPeriodLike = {
  periodKey: string
  status: string | null
}

export type CounterpartyLike = CounterpartyResolutionCounterpartyInput

export type TransactionDetailFiscalDependencies = {
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

export type TransactionDetailWorkflowDependencies = TransactionDetailBaseDependencies &
  TransactionDetailFiscalDependencies
