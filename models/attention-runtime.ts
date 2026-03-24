import config from "../lib/config.ts"
import { buildAttentionSummary, type AttentionSummary } from "../lib/attention-contract.ts"
import { readMobileTriageMetadata } from "../lib/mobile-triage-shared.ts"
import { buildReadinessSummary, detectLocalBackupBaseline } from "../lib/readiness.ts"
import type { TransactionFilters, TransactionPagination } from "./transactions.ts"

export type RuntimeInput = {
  organizationId: string
  organizationName: string
  userId: string
  businessAddress?: string | null
  selfHosted?: boolean
}

export type RuntimeDependencies = {
  getSettings?: (organizationId: string) => Promise<Record<string, string>>
  getLLMSettings?: (settings: Record<string, string>) => { providers: Array<{ provider: string; apiKey?: string; model?: string }> }
  getUnsortedFiles?: (organizationId: string) => Promise<Array<{ isReviewed?: boolean; metadata: unknown }>>
  getFields?: (organizationId: string) => Promise<unknown[]>
  getTransactions?: (
    organizationId: string,
    filters?: TransactionFilters,
    pagination?: TransactionPagination
  ) => Promise<{ transactions: Array<Record<string, unknown>> }>
  isTransactionIncomplete?: (fields: unknown[], transaction: Record<string, unknown>) => boolean
  getFiscalProfileAccessByOrganizationId?: (
    organizationId: string,
    userId: string
  ) => Promise<{ status: string; profile: { id: string } | null }>
  getFiscalReviewQueue?: (
    ownerScopeId: string
  ) => Promise<{ summary: { blocked: number; needs_review: number } }>
  listQuarterlyDrafts?: (
    ownerScopeId: string
  ) => Promise<Array<{ period: { periodKey: string }; operationalStatus: { code: string } }>>
  detectLocalBackupBaseline?: typeof detectLocalBackupBaseline
}

export type NavigationAttentionSummary = Pick<AttentionSummary, "counts" | "items" | "readiness" | "topItem">

type AttentionRuntimeMode = {
  includeTransactions: boolean
  includeActiveQuarterLabel: boolean
}

type AttentionBaseContext = {
  readiness: ReturnType<typeof buildReadinessSummary>
  unsortedFiles: Array<{ isReviewed?: boolean; metadata: unknown }>
  fiscalAccess: { status: string; profile: { id: string } | null }
}

type ResolvedAttentionRuntimeDependencies = {
  getSettings: NonNullable<RuntimeDependencies["getSettings"]>
  getLLMSettings: NonNullable<RuntimeDependencies["getLLMSettings"]>
  getUnsortedFiles: NonNullable<RuntimeDependencies["getUnsortedFiles"]>
  getFiscalProfileAccessByOrganizationId: NonNullable<RuntimeDependencies["getFiscalProfileAccessByOrganizationId"]>
  getFiscalReviewQueue: NonNullable<RuntimeDependencies["getFiscalReviewQueue"]>
  detectLocalBackupBaseline: typeof detectLocalBackupBaseline
  getFields?: NonNullable<RuntimeDependencies["getFields"]>
  getTransactions?: NonNullable<RuntimeDependencies["getTransactions"]>
  isTransactionIncomplete?: NonNullable<RuntimeDependencies["isTransactionIncomplete"]>
  listQuarterlyDrafts?: NonNullable<RuntimeDependencies["listQuarterlyDrafts"]>
}

function countDeferredToDesktop(unsortedFiles: AttentionBaseContext["unsortedFiles"]) {
  return unsortedFiles.filter((file) => {
    const triage = readMobileTriageMetadata(file.metadata)
    return triage?.disposition === "deferred"
  }).length
}

async function resolveAttentionRuntimeDependencies(
  dependencies: RuntimeDependencies,
  mode: AttentionRuntimeMode
): Promise<ResolvedAttentionRuntimeDependencies> {
  const deps: ResolvedAttentionRuntimeDependencies = {
    getSettings: dependencies.getSettings!,
    getLLMSettings: dependencies.getLLMSettings!,
    getUnsortedFiles: dependencies.getUnsortedFiles!,
    getFiscalProfileAccessByOrganizationId: dependencies.getFiscalProfileAccessByOrganizationId!,
    getFiscalReviewQueue: dependencies.getFiscalReviewQueue!,
    detectLocalBackupBaseline: dependencies.detectLocalBackupBaseline ?? detectLocalBackupBaseline,
    getFields: dependencies.getFields,
    getTransactions: dependencies.getTransactions,
    isTransactionIncomplete: dependencies.isTransactionIncomplete,
    listQuarterlyDrafts: dependencies.listQuarterlyDrafts,
  }

  if (!deps.getSettings || !deps.getLLMSettings) {
    const settingsModule = await import("./settings.ts")
    deps.getSettings ??= settingsModule.getSettings
    deps.getLLMSettings ??= settingsModule.getLLMSettings
  }

  if (!deps.getUnsortedFiles) {
    const filesModule = await import("./files.ts")
    deps.getUnsortedFiles = filesModule.getUnsortedFiles
  }

  if (!deps.getFiscalProfileAccessByOrganizationId) {
    const fiscalProfileModule = await import("./fiscal/profile.ts")
    deps.getFiscalProfileAccessByOrganizationId = fiscalProfileModule.getFiscalProfileAccessByOrganizationId
  }

  if (!deps.getFiscalReviewQueue) {
    const fiscalReviewModule = await import("./fiscal/review-queue.ts")
    deps.getFiscalReviewQueue = fiscalReviewModule.getFiscalReviewQueue
  }

  if (mode.includeTransactions && (!deps.getFields || !deps.getTransactions)) {
    const [fieldsModule, transactionsModule] = await Promise.all([
      import("./fields.ts"),
      import("./transactions.ts"),
    ])

    deps.getFields ??= fieldsModule.getFields
    deps.getTransactions ??= transactionsModule.getTransactions
  }

  if (mode.includeTransactions && !deps.isTransactionIncomplete) {
    const statsModule = await import("../lib/stats.ts")
    deps.isTransactionIncomplete = (fields, transaction) =>
      statsModule.isTransactionIncomplete(fields as never, transaction as never)
  }

  if (mode.includeActiveQuarterLabel && !deps.listQuarterlyDrafts) {
    const fiscalDraftModule = await import("./fiscal/quarterly-draft.ts")
    deps.listQuarterlyDrafts = fiscalDraftModule.listQuarterlyDrafts
  }

  return deps
}

async function loadAttentionBaseContext(
  input: RuntimeInput,
  dependencies: ResolvedAttentionRuntimeDependencies
): Promise<AttentionBaseContext> {
  const [settings, unsortedFiles, fiscalAccess, backupReady] = await Promise.all([
    dependencies.getSettings(input.organizationId),
    dependencies.getUnsortedFiles(input.organizationId),
    dependencies.getFiscalProfileAccessByOrganizationId(input.organizationId, input.userId),
    dependencies.detectLocalBackupBaseline(),
  ])

  const llmConfigured = dependencies.getLLMSettings(settings).providers.length > 0

  return {
    readiness: buildReadinessSummary({
      organizationName: input.organizationName,
      businessAddress: input.businessAddress,
      llmConfigured,
      fiscalProfileReady: fiscalAccess.status === "ready",
      backupReady,
      selfHosted: input.selfHosted ?? config.selfHosted.isEnabled,
    }),
    unsortedFiles,
    fiscalAccess,
  }
}

async function resolveTransactionExceptionCount(
  organizationId: string,
  dependencies: ResolvedAttentionRuntimeDependencies,
  mode: AttentionRuntimeMode
) {
  if (!mode.includeTransactions || !dependencies.getFields || !dependencies.getTransactions) {
    return 0
  }

  const [fields, transactionResult] = await Promise.all([
    dependencies.getFields(organizationId),
    dependencies.getTransactions(organizationId),
  ])

  return transactionResult.transactions.filter((transaction) => dependencies.isTransactionIncomplete?.(fields, transaction)).length
}

async function resolveFiscalSignals(
  baseContext: AttentionBaseContext,
  dependencies: ResolvedAttentionRuntimeDependencies,
  mode: AttentionRuntimeMode
) {
  if (baseContext.fiscalAccess.status !== "ready" || !baseContext.fiscalAccess.profile) {
    return {
      fiscalBlockedCount: 0,
      fiscalNeedsReviewCount: 0,
      activeQuarterLabel: null,
    }
  }

  const queuePromise = dependencies.getFiscalReviewQueue(baseContext.fiscalAccess.profile.id)
  const draftsPromise =
    mode.includeActiveQuarterLabel && dependencies.listQuarterlyDrafts
      ? dependencies.listQuarterlyDrafts(baseContext.fiscalAccess.profile.id)
      : Promise.resolve([])

  const [queue, drafts] = await Promise.all([queuePromise, draftsPromise])

  return {
    fiscalBlockedCount: queue.summary.blocked,
    fiscalNeedsReviewCount: queue.summary.needs_review,
    activeQuarterLabel:
      drafts.find((draft) => ["open", "review_pending", "review_blocked", "ready"].includes(draft.operationalStatus.code))
        ?.period.periodKey ?? null,
  }
}

async function buildAttentionSummaryFromRuntime(
  input: RuntimeInput,
  dependencies: RuntimeDependencies,
  mode: AttentionRuntimeMode
) {
  const resolvedDependencies = await resolveAttentionRuntimeDependencies(dependencies, mode)
  const baseContext = await loadAttentionBaseContext(input, resolvedDependencies)
  const [transactionExceptionCount, fiscalSignals] = await Promise.all([
    resolveTransactionExceptionCount(input.organizationId, resolvedDependencies, mode),
    resolveFiscalSignals(baseContext, resolvedDependencies, mode),
  ])

  return buildAttentionSummary({
    readiness: baseContext.readiness,
    unsortedCount: baseContext.unsortedFiles.length,
    deferredToDesktopCount: countDeferredToDesktop(baseContext.unsortedFiles),
    transactionExceptionCount,
    ...fiscalSignals,
  })
}

export async function getAttentionSummaryRuntime(
  input: RuntimeInput,
  dependencies: RuntimeDependencies = {}
): Promise<AttentionSummary> {
  return buildAttentionSummaryFromRuntime(input, dependencies, {
    includeTransactions: true,
    includeActiveQuarterLabel: true,
  })
}

export async function getNavigationAttentionSummaryRuntime(
  input: RuntimeInput,
  dependencies: RuntimeDependencies = {}
): Promise<NavigationAttentionSummary> {
  return buildAttentionSummaryFromRuntime(input, dependencies, {
    includeTransactions: false,
    includeActiveQuarterLabel: false,
  })
}
