import type {
  TransactionDetailBaseDependencies,
  TransactionDetailFiscalDependencies,
  TransactionsWorkflowDependencies,
} from "./types.ts"
import type { CounterpartyResolution } from "../../fiscal/counterparty-resolution.ts"
import type { Field } from "../../../prisma/client"

function defaultIncompleteTransactionFields(
  fields: Field[],
  transaction: Record<string, unknown> & { extra?: Record<string, unknown> | null }
) {
  const requiredFields = fields.filter((field) => field.isRequired)

  return requiredFields.filter((field) => {
    const value = field.isExtra ? transaction.extra?.[field.code] : transaction[field.code]
    return value === undefined || value === null || value === ""
  })
}

export async function resolveTransactionsDependencies(
  dependencies: TransactionsWorkflowDependencies
): Promise<Required<TransactionsWorkflowDependencies>> {
  const deps = { ...dependencies }

  if (!deps.getCategories) {
    const categoriesModule = await import("../../categories.ts")
    deps.getCategories = categoriesModule.getCategories
  }

  if (!deps.getProjects) {
    const projectsModule = await import("../../projects.ts")
    deps.getProjects = projectsModule.getProjects
  }

  if (!deps.getFields || !deps.getTransactions || !deps.getTransactionAttentionSignals) {
    const transactionsModule = await import("../../transactions.ts")
    deps.getFields ??= (await import("../../fields.ts")).getFields
    deps.getTransactions ??= transactionsModule.getTransactions
    deps.getTransactionAttentionSignals ??= transactionsModule.getTransactionAttentionSignals
  }

  return deps as Required<TransactionsWorkflowDependencies>
}

export async function resolveTransactionDetailBaseDependencies(
  dependencies: TransactionDetailBaseDependencies
): Promise<Required<TransactionDetailBaseDependencies>> {
  const deps = { ...dependencies }

  if (!deps.getTransactionById || !deps.getTransactionAttentionSignals) {
    const transactionsModule = await import("../../transactions.ts")
    deps.getTransactionById ??= transactionsModule.getTransactionById
    deps.getTransactionAttentionSignals ??= transactionsModule.getTransactionAttentionSignals
  }

  if (!deps.getFilesByTransactionId) {
    deps.getFilesByTransactionId = (await import("../../files.ts")).getFilesByTransactionId
  }

  if (!deps.getCategories) {
    deps.getCategories = (await import("../../categories.ts")).getCategories
  }

  if (!deps.getCurrencies) {
    deps.getCurrencies = (await import("../../currencies.ts")).getCurrencies
  }

  if (!deps.getSettings) {
    deps.getSettings = (await import("../../settings.ts")).getSettings
  }

  if (!deps.getFields) {
    deps.getFields = (await import("../../fields.ts")).getFields
  }

  if (!deps.getProjects) {
    deps.getProjects = (await import("../../projects.ts")).getProjects
  }

  if (!deps.getFiscalProfileAccessByOrganizationId) {
    deps.getFiscalProfileAccessByOrganizationId = (
      await import("../../fiscal/profile.ts")
    ).getFiscalProfileAccessByOrganizationId
  }

  if (!deps.incompleteTransactionFields) {
    deps.incompleteTransactionFields = (fields, transaction) =>
      defaultIncompleteTransactionFields(fields, transaction as Record<string, unknown> & {
        extra?: Record<string, unknown> | null
      })
  }

  return deps as Required<TransactionDetailBaseDependencies>
}

export async function resolveTransactionDetailFiscalDependencies(
  dependencies: TransactionDetailFiscalDependencies
): Promise<Required<TransactionDetailFiscalDependencies>> {
  const deps = { ...dependencies }

  if (!deps.getTransactionFiscalBySourceTransactionId) {
    deps.getTransactionFiscalBySourceTransactionId = (
      await import("../../fiscal/transaction-fiscal.ts")
    ).getTransactionFiscalBySourceTransactionId
  }

  if (!deps.syncDefaultSpanishFiscalPeriodsV1 || !deps.getFiscalPeriodByKey) {
    const periodsModule = await import("../../fiscal/periods.ts")
    deps.syncDefaultSpanishFiscalPeriodsV1 ??= periodsModule.syncDefaultSpanishFiscalPeriodsV1
    deps.getFiscalPeriodByKey ??= periodsModule.getFiscalPeriodByKey
  }

  if (!deps.getCounterparties) {
    deps.getCounterparties = (await import("../../fiscal/counterparties.ts")).getCounterparties
  }

  if (!deps.resolveCounterpartyResolution) {
    deps.resolveCounterpartyResolution = (
      await import("../../fiscal/counterparty-resolution.ts")
    ).resolveCounterpartyResolution as (input: unknown) => CounterpartyResolution | null
  }

  return deps as Required<TransactionDetailFiscalDependencies>
}
