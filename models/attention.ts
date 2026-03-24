import config from "@/lib/config"
import { readMobileTriageMetadata } from "@/lib/mobile-triage"
import { isTransactionIncomplete } from "@/lib/stats"
import { buildReadinessSummary, detectLocalBackupBaseline } from "@/lib/readiness"
import { buildAttentionSummary, type AttentionSummary } from "@/lib/attention-contract"

type RuntimeInput = {
  organizationId: string
  organizationName: string
  userId: string
  businessAddress?: string | null
  selfHosted?: boolean
}

type RuntimeDependencies = {
  getSettings?: (organizationId: string) => Promise<Record<string, string>>
  getLLMSettings?: (settings: Record<string, string>) => { providers: Array<{ provider: string; apiKey?: string; model?: string }> }
  getUnsortedFiles?: (organizationId: string) => Promise<Array<{ isReviewed?: boolean; metadata: unknown }>>
  getFields?: (organizationId: string) => Promise<unknown[]>
  getTransactions?: (
    organizationId: string,
    filters?: unknown,
    pagination?: unknown
  ) => Promise<{ transactions: Array<Record<string, unknown>> }>
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

type NavigationAttentionSummary = Pick<AttentionSummary, "counts" | "items" | "readiness" | "topItem">

function isIncompleteTransaction(transaction: Record<string, unknown>, fields: unknown[]) {
  return isTransactionIncomplete(fields as never, transaction as never)
}

export async function getAttentionSummary(
  input: RuntimeInput,
  dependencies: RuntimeDependencies = {}
): Promise<AttentionSummary> {
  const settingsModule = await import("./settings")
  const filesModule = await import("./files")
  const fieldsModule = await import("./fields")
  const transactionsModule = await import("./transactions")
  const fiscalProfileModule = await import("./fiscal/profile")
  const fiscalReviewModule = await import("./fiscal/review-queue")
  const fiscalDraftModule = await import("./fiscal/quarterly-draft")

  const getSettings = dependencies.getSettings ?? settingsModule.getSettings
  const getLLMSettings = dependencies.getLLMSettings ?? settingsModule.getLLMSettings
  const getUnsortedFiles = dependencies.getUnsortedFiles ?? filesModule.getUnsortedFiles
  const getFields = dependencies.getFields ?? fieldsModule.getFields
  const getTransactions = dependencies.getTransactions ?? transactionsModule.getTransactions
  const getFiscalProfileAccessByOrganizationId =
    dependencies.getFiscalProfileAccessByOrganizationId ?? fiscalProfileModule.getFiscalProfileAccessByOrganizationId
  const getFiscalReviewQueue = dependencies.getFiscalReviewQueue ?? fiscalReviewModule.getFiscalReviewQueue
  const listQuarterlyDrafts = dependencies.listQuarterlyDrafts ?? fiscalDraftModule.listQuarterlyDrafts
  const resolveBackupBaseline = dependencies.detectLocalBackupBaseline ?? detectLocalBackupBaseline

  const [settings, unsortedFiles, fields, transactionResult, fiscalAccess, backupReady] = await Promise.all([
    getSettings(input.organizationId),
    getUnsortedFiles(input.organizationId),
    getFields(input.organizationId),
    getTransactions(input.organizationId),
    getFiscalProfileAccessByOrganizationId(input.organizationId, input.userId),
    resolveBackupBaseline(),
  ])

  const llmConfigured = getLLMSettings(settings).providers.length > 0
  const readiness = buildReadinessSummary({
    organizationName: input.organizationName,
    businessAddress: input.businessAddress,
    llmConfigured,
    fiscalProfileReady: fiscalAccess.status === "ready",
    backupReady,
    selfHosted: input.selfHosted ?? config.selfHosted.isEnabled,
  })

  const deferredToDesktopCount = unsortedFiles.filter((file) => {
    const triage = readMobileTriageMetadata(file.metadata)
    return triage?.disposition === "deferred"
  }).length

  const transactionExceptionCount = transactionResult.transactions.filter((transaction) =>
    isIncompleteTransaction(transaction, fields)
  ).length

  let fiscalBlockedCount = 0
  let fiscalNeedsReviewCount = 0
  let activeQuarterLabel: string | null = null

  if (fiscalAccess.status === "ready" && fiscalAccess.profile) {
    const [queue, drafts] = await Promise.all([
      getFiscalReviewQueue(fiscalAccess.profile.id),
      listQuarterlyDrafts(fiscalAccess.profile.id),
    ])

    fiscalBlockedCount = queue.summary.blocked
    fiscalNeedsReviewCount = queue.summary.needs_review
    activeQuarterLabel =
      drafts.find((draft) => ["open", "review_pending", "review_blocked", "ready"].includes(draft.operationalStatus.code))
        ?.period.periodKey ?? null
  }

  return buildAttentionSummary({
    readiness,
    unsortedCount: unsortedFiles.length,
    deferredToDesktopCount,
    transactionExceptionCount,
    fiscalBlockedCount,
    fiscalNeedsReviewCount,
    activeQuarterLabel,
  })
}

export async function getNavigationAttentionSummary(
  input: RuntimeInput,
  dependencies: RuntimeDependencies = {}
): Promise<NavigationAttentionSummary> {
  const settingsModule = await import("./settings")
  const filesModule = await import("./files")
  const fiscalProfileModule = await import("./fiscal/profile")
  const fiscalReviewModule = await import("./fiscal/review-queue")

  const getSettings = dependencies.getSettings ?? settingsModule.getSettings
  const getLLMSettings = dependencies.getLLMSettings ?? settingsModule.getLLMSettings
  const getUnsortedFiles = dependencies.getUnsortedFiles ?? filesModule.getUnsortedFiles
  const getFiscalProfileAccessByOrganizationId =
    dependencies.getFiscalProfileAccessByOrganizationId ?? fiscalProfileModule.getFiscalProfileAccessByOrganizationId
  const getFiscalReviewQueue = dependencies.getFiscalReviewQueue ?? fiscalReviewModule.getFiscalReviewQueue
  const resolveBackupBaseline = dependencies.detectLocalBackupBaseline ?? detectLocalBackupBaseline

  const [settings, unsortedFiles, fiscalAccess, backupReady] = await Promise.all([
    getSettings(input.organizationId),
    getUnsortedFiles(input.organizationId),
    getFiscalProfileAccessByOrganizationId(input.organizationId, input.userId),
    resolveBackupBaseline(),
  ])

  const llmConfigured = getLLMSettings(settings).providers.length > 0
  const readiness = buildReadinessSummary({
    organizationName: input.organizationName,
    businessAddress: input.businessAddress,
    llmConfigured,
    fiscalProfileReady: fiscalAccess.status === "ready",
    backupReady,
    selfHosted: input.selfHosted ?? config.selfHosted.isEnabled,
  })

  const deferredToDesktopCount = unsortedFiles.filter((file) => {
    const triage = readMobileTriageMetadata(file.metadata)
    return triage?.disposition === "deferred"
  }).length

  let fiscalBlockedCount = 0
  let fiscalNeedsReviewCount = 0

  if (fiscalAccess.status === "ready" && fiscalAccess.profile) {
    const queue = await getFiscalReviewQueue(fiscalAccess.profile.id)
    fiscalBlockedCount = queue.summary.blocked
    fiscalNeedsReviewCount = queue.summary.needs_review
  }

  return buildAttentionSummary({
    readiness,
    unsortedCount: unsortedFiles.length,
    deferredToDesktopCount,
    transactionExceptionCount: 0,
    fiscalBlockedCount,
    fiscalNeedsReviewCount,
    activeQuarterLabel: null,
  })
}
