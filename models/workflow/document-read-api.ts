import { canAnalyzeFileMimeType } from "../../lib/analysis-support.ts"
import type { AttentionSummary } from "../../lib/attention-contract.ts"
import type { ReadinessSummary } from "../../lib/readiness.ts"
import type { JsonValue } from "@prisma/client/runtime/library"
import type { MobileInboxItem, MobileSystemStatus } from "../mobile/types.ts"
import { buildUnsortedInboxItems, type UnsortedInboxSummary } from "../unsorted-inbox.ts"
import { buildDocumentWorkflowItems } from "./projectors/documents.ts"
import { buildWorkflowReadModelFromAttention } from "./read-api.ts"
import type { WorkflowItem, WorkflowReadModel } from "./contracts.ts"

type LlmProviderLike = {
  provider: string
  apiKey?: string
  model?: string
}

type FileLike = {
  id: string
  path: string
  createdAt: Date
  userId: string
  organizationId: string
  filename: string
  mimetype: string
  metadata: JsonValue
  cachedParseResult: JsonValue
  isReviewed: boolean
  isSplitted: boolean
}

type DashboardInput = {
  organizationId: string
  organizationName: string
  userId: string
  businessAddress?: string | null
}

type UnsortedInput = {
  organizationId: string
  userId: string
}

type DashboardDependencies = {
  getAttentionSummary?: (input: DashboardInput) => Promise<AttentionSummary>
  getUnsortedFiles?: (organizationId: string) => Promise<FileLike[]>
  getSettings?: (organizationId: string) => Promise<Record<string, string>>
  getLLMSettings?: (settings: Record<string, string>) => { providers: LlmProviderLike[] }
}

type UnsortedDependencies = {
  getUnsortedFiles?: (organizationId: string) => Promise<FileLike[]>
  getSettings?: (organizationId: string) => Promise<Record<string, string>>
  getLLMSettings?: (settings: Record<string, string>) => { providers: LlmProviderLike[] }
  getFiscalProfileAccessByOrganizationId?: (
    organizationId: string,
    userId: string
  ) => Promise<{ status: string; profile: { id: string } | null }>
  getFiscalReviewQueue?: (
    ownerScopeId: string
  ) => Promise<{ items: Array<{ owner: string | null }> }>
}

type CaptureWorkflowUser = {
  id: string
  organizationId: string
  email: string
  storageLimit: number
  storageUsed: number
  membershipExpiresAt: Date | null
  accessStatus?: string | null
}

type CaptureInboxResponse = {
  items: MobileInboxItem[]
  systemStatus: MobileSystemStatus
}

type CaptureDependencies = {
  getMobileInbox?: (user: CaptureWorkflowUser) => Promise<CaptureInboxResponse>
  getFiscalProfileAccessByOrganizationId?: (
    organizationId: string,
    userId: string
  ) => Promise<{ status: string; profile: { id: string } | null }>
  getFiscalReviewQueue?: (
    ownerScopeId: string
  ) => Promise<{ items: Array<{ owner: string | null }> }>
}

export type DashboardWorkflowDocumentView = {
  settings: Record<string, string>
  attention: AttentionSummary
  attentionWorkflow: WorkflowReadModel<ReadinessSummary>
  unsorted: {
    files: FileLike[]
    summaries: UnsortedInboxSummary[]
    items: WorkflowItem[]
    hasConfiguredLlmProvider: boolean
  }
}

export type UnsortedWorkflowDocumentView = {
  files: FileLike[]
  settings: Record<string, string>
  summaries: UnsortedInboxSummary[]
  items: WorkflowItem[]
  hasConfiguredLlmProvider: boolean
  counts: {
    analyzable: number
    saveable: number
    deferredToDesktop: number
    openClientReviewRequests: number
  }
}

export type CaptureWorkflowInboxView = {
  inbox: CaptureInboxResponse
  openClientReviewRequestCount: number
}

function hasConfiguredProvider(providers: LlmProviderLike[]) {
  return providers.some(
    (provider) => provider.provider === "pool_cloud" || Boolean(provider.apiKey && provider.model)
  )
}

async function resolveDashboardDependencies(dependencies: DashboardDependencies): Promise<Required<DashboardDependencies>> {
  const deps = { ...dependencies }

  if (!deps.getAttentionSummary) {
    const attentionModule = await import("../attention.ts")
    deps.getAttentionSummary = attentionModule.getAttentionSummary
  }

  if (!deps.getUnsortedFiles) {
    const filesModule = await import("../files.ts")
    deps.getUnsortedFiles = filesModule.getUnsortedFiles
  }

  if (!deps.getSettings || !deps.getLLMSettings) {
    const settingsModule = await import("../settings.ts")
    deps.getSettings ??= settingsModule.getSettings
    deps.getLLMSettings ??= settingsModule.getLLMSettings
  }

  return deps as Required<DashboardDependencies>
}

async function resolveUnsortedDependencies(dependencies: UnsortedDependencies): Promise<Required<UnsortedDependencies>> {
  const deps = { ...dependencies }

  if (!deps.getUnsortedFiles) {
    const filesModule = await import("../files.ts")
    deps.getUnsortedFiles = filesModule.getUnsortedFiles
  }

  if (!deps.getSettings || !deps.getLLMSettings) {
    const settingsModule = await import("../settings.ts")
    deps.getSettings ??= settingsModule.getSettings
    deps.getLLMSettings ??= settingsModule.getLLMSettings
  }

  if (!deps.getFiscalProfileAccessByOrganizationId) {
    const fiscalProfileModule = await import("../fiscal/profile.ts")
    deps.getFiscalProfileAccessByOrganizationId = fiscalProfileModule.getFiscalProfileAccessByOrganizationId
  }

  if (!deps.getFiscalReviewQueue) {
    const fiscalReviewModule = await import("../fiscal/review-queue.ts")
    deps.getFiscalReviewQueue = fiscalReviewModule.getFiscalReviewQueue
  }

  return deps as Required<UnsortedDependencies>
}

async function resolveCaptureDependencies(dependencies: CaptureDependencies): Promise<Required<CaptureDependencies>> {
  const deps = { ...dependencies }

  if (!deps.getMobileInbox) {
    const mobileInboxModule = await import("../mobile/inbox.ts")
    deps.getMobileInbox = mobileInboxModule.getMobileInbox
  }

  if (!deps.getFiscalProfileAccessByOrganizationId) {
    const fiscalProfileModule = await import("../fiscal/profile.ts")
    deps.getFiscalProfileAccessByOrganizationId = fiscalProfileModule.getFiscalProfileAccessByOrganizationId
  }

  if (!deps.getFiscalReviewQueue) {
    const fiscalReviewModule = await import("../fiscal/review-queue.ts")
    deps.getFiscalReviewQueue = fiscalReviewModule.getFiscalReviewQueue
  }

  return deps as Required<CaptureDependencies>
}

export async function getDashboardWorkflowDocumentView(
  input: DashboardInput,
  dependencies: DashboardDependencies = {}
): Promise<DashboardWorkflowDocumentView> {
  const deps = await resolveDashboardDependencies(dependencies)
  const [attention, files, settings] = await Promise.all([
    deps.getAttentionSummary(input),
    deps.getUnsortedFiles(input.organizationId),
    deps.getSettings(input.organizationId),
  ])

  const hasConfiguredLlmProvider = hasConfiguredProvider(deps.getLLMSettings(settings).providers)
  const summaries = buildUnsortedInboxItems(files, {
    llmConfigured: hasConfiguredLlmProvider,
  })

  return {
    settings,
    attention,
    attentionWorkflow: buildWorkflowReadModelFromAttention(attention),
    unsorted: {
      files,
      summaries,
      items: buildDocumentWorkflowItems(summaries),
      hasConfiguredLlmProvider,
    },
  }
}

export async function getUnsortedWorkflowDocumentView(
  input: UnsortedInput,
  dependencies: UnsortedDependencies = {}
): Promise<UnsortedWorkflowDocumentView> {
  const deps = await resolveUnsortedDependencies(dependencies)
  const [files, settings, fiscalProfileAccess] = await Promise.all([
    deps.getUnsortedFiles(input.organizationId),
    deps.getSettings(input.organizationId),
    deps.getFiscalProfileAccessByOrganizationId(input.organizationId, input.userId),
  ])

  const hasConfiguredLlmProvider = hasConfiguredProvider(deps.getLLMSettings(settings).providers)
  const summaries = buildUnsortedInboxItems(files, {
    llmConfigured: hasConfiguredLlmProvider,
  })

  let openClientReviewRequests = 0

  if (fiscalProfileAccess.status === "ready" && fiscalProfileAccess.profile) {
    const queue = await deps.getFiscalReviewQueue(fiscalProfileAccess.profile.id)
    openClientReviewRequests = queue.items.filter((item) => item.owner === "client").length
  }

  return {
    files,
    settings,
    summaries,
    items: buildDocumentWorkflowItems(summaries),
    hasConfiguredLlmProvider,
    counts: {
      analyzable: files.filter((file) => !file.isSplitted && canAnalyzeFileMimeType(file.mimetype)).length,
      saveable: summaries.filter((summary) => summary.state === "ready_to_review").length,
      deferredToDesktop: summaries.filter((summary) => summary.state === "deferred_to_desktop").length,
      openClientReviewRequests,
    },
  }
}

export async function getCaptureWorkflowInboxView(
  user: CaptureWorkflowUser,
  dependencies: CaptureDependencies = {}
): Promise<CaptureWorkflowInboxView> {
  const deps = await resolveCaptureDependencies(dependencies)
  const [inbox, fiscalProfileAccess] = await Promise.all([
    deps.getMobileInbox(user),
    deps.getFiscalProfileAccessByOrganizationId(user.organizationId, user.id),
  ])

  if (fiscalProfileAccess.status !== "ready" || !fiscalProfileAccess.profile) {
    return {
      inbox,
      openClientReviewRequestCount: 0,
    }
  }

  const reviewQueue = await deps.getFiscalReviewQueue(fiscalProfileAccess.profile.id)

  return {
    inbox,
    openClientReviewRequestCount: reviewQueue.items.filter((item) => item.owner === "client").length,
  }
}
