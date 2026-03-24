import { mergeMobileTriageMetadata, readMobileTriageMetadata } from "../../../../../lib/mobile-triage.ts"
import { MOBILE_REASON_CODE } from "../../../../../models/mobile/types.ts"

export interface MobileReviewSubmitInput {
  fileId: string
  merchant: string | null | undefined
  issuedAt: string | null | undefined
  total: string | null | undefined
  currencyCode: string | null | undefined
  invoiceNumber: string | null | undefined
  categoryCode: string | null | undefined
}

export interface MobileReviewActionResult {
  success: boolean
  error?: string | null
}

export type MobileReviewUser = {
  id: string
}

export type MobileReviewFile = {
  id: string
  userId?: string
  isReviewed?: boolean
  metadata: unknown
  cachedParseResult: unknown
}

export type MobileReviewSettings = {
  default_currency?: string | null
  default_category?: string | null
  default_type?: string | null
  default_project?: string | null
}

export type ReviewActionDependencies = {
  now?: () => string
  getCurrentUser: () => Promise<MobileReviewUser>
  getCurrentOrganizationId: () => Promise<string>
  getFileById: (fileId: string, organizationId: string) => Promise<MobileReviewFile | null>
  updateFile: (fileId: string, organizationId: string, data: Record<string, unknown>) => Promise<unknown>
  getSettings: (organizationId: string) => Promise<MobileReviewSettings>
  getFields: (organizationId: string) => Promise<unknown>
  getCategories: (organizationId: string) => Promise<unknown>
  getProjects: (organizationId: string) => Promise<unknown>
  startAnalysisJobAction: (
    file: MobileReviewFile,
    settings: MobileReviewSettings,
    fields: unknown,
    categories: unknown,
    projects: unknown
  ) => Promise<{ success: boolean; error?: string | null; data?: unknown }>
  saveFileAsTransactionAction: (
    prevState: unknown,
    formData: FormData
  ) => Promise<{ success: boolean; error?: string | null }>
  revalidatePath: (path: string) => void
}

const REVIEW_NOT_AVAILABLE_ERROR = "Este documento ya no esta disponible para revision movil."
const FILE_NOT_FOUND_ERROR = "Documento no encontrado."

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function mergeCachedParseResult(file: MobileReviewFile, input: MobileReviewSubmitInput, settings: MobileReviewSettings) {
  const normalizedInput = normalizeMobileReviewSubmitInput(input, settings)
  const currentParseResult = isRecord(file.cachedParseResult) ? file.cachedParseResult : {}

  return {
    ...currentParseResult,
    merchant: normalizedInput.merchant,
    issuedAt: normalizedInput.issuedAt,
    total: normalizedInput.total,
    currencyCode: normalizedInput.currencyCode,
    invoice_number: normalizedInput.invoiceNumber,
    categoryCode: normalizedInput.categoryCode,
  }
}

function normalizeInputString(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return ""
  }

  const normalized = value.trim()
  if (normalized === "undefined" || normalized === "null") {
    return ""
  }

  return normalized
}

function normalizeMobileReviewSubmitInput(input: MobileReviewSubmitInput, settings: MobileReviewSettings) {
  const currencyCode = normalizeInputString(input.currencyCode) || settings.default_currency || "EUR"
  const categoryCode = normalizeInputString(input.categoryCode) || settings.default_category || ""

  return {
    fileId: input.fileId,
    merchant: normalizeInputString(input.merchant),
    issuedAt: normalizeInputString(input.issuedAt),
    total: normalizeInputString(input.total),
    currencyCode,
    invoiceNumber: normalizeInputString(input.invoiceNumber),
    categoryCode,
  }
}

function isMobileReviewAvailable(file: MobileReviewFile, options?: { allowRetryFromDeferred?: boolean }) {
  const mobileTriage = readMobileTriageMetadata(file.metadata)
  if (!mobileTriage || mobileTriage.source !== "mobile_capture" || file.isReviewed) {
    return false
  }

  if (!options?.allowRetryFromDeferred && mobileTriage.disposition === "deferred") {
    return false
  }

  if (
    options?.allowRetryFromDeferred
    && mobileTriage.disposition === "deferred"
    && mobileTriage.reasonCode === MOBILE_REASON_CODE.USER_DEFERRED
  ) {
    return false
  }

  return true
}

export function createMobileReviewActions(dependencies: ReviewActionDependencies) {
  const deps = {
    now: () => new Date().toISOString(),
    ...dependencies,
  }

  async function acceptMobileReviewAction(input: MobileReviewSubmitInput): Promise<MobileReviewActionResult> {
    await deps.getCurrentUser()
    const organizationId = await deps.getCurrentOrganizationId()
    const file = await deps.getFileById(input.fileId, organizationId)
    if (!file) {
      return {
        success: false,
        error: FILE_NOT_FOUND_ERROR,
      }
    }

    if (!isMobileReviewAvailable(file)) {
      return {
        success: false,
        error: REVIEW_NOT_AVAILABLE_ERROR,
      }
    }

    const settings = await deps.getSettings(organizationId)
    const normalizedInput = normalizeMobileReviewSubmitInput(input, settings)
    await deps.updateFile(file.id, organizationId, {
      cachedParseResult: mergeCachedParseResult(file, normalizedInput, settings),
      metadata: mergeMobileTriageMetadata({
        metadata: file.metadata,
        disposition: "pending",
        updatedAt: deps.now(),
      }),
    })

    const formData = new FormData()
    formData.set("fileId", normalizedInput.fileId)
    formData.set("merchant", normalizedInput.merchant)
    formData.set("issuedAt", normalizedInput.issuedAt)
    formData.set("total", normalizedInput.total)
    formData.set("currencyCode", normalizedInput.currencyCode)
    formData.set("categoryCode", normalizedInput.categoryCode)
    formData.set("type", settings.default_type || "expense")
    formData.set("projectCode", settings.default_project || "")
    formData.set("invoice_number", normalizedInput.invoiceNumber)
    formData.set("name", normalizedInput.invoiceNumber || normalizedInput.merchant || "Documento móvil")

    const result = await deps.saveFileAsTransactionAction(null, formData)

    deps.revalidatePath("/capture")
    deps.revalidatePath("/capture/inbox")

    if (!result.success) {
      return {
        success: false,
        error: result.error || "No se ha podido guardar la transacción.",
      }
    }

    return { success: true }
  }

  async function retryMobileReviewAction(fileId: string): Promise<MobileReviewActionResult> {
    await deps.getCurrentUser()
    const organizationId = await deps.getCurrentOrganizationId()
    const file = await deps.getFileById(fileId, organizationId)

    if (!file) {
      return {
        success: false,
        error: FILE_NOT_FOUND_ERROR,
      }
    }

    if (!isMobileReviewAvailable(file, { allowRetryFromDeferred: true })) {
      return {
        success: false,
        error: REVIEW_NOT_AVAILABLE_ERROR,
      }
    }

    const [settings, fields, categories, projects] = await Promise.all([
      deps.getSettings(organizationId),
      deps.getFields(organizationId),
      deps.getCategories(organizationId),
      deps.getProjects(organizationId),
    ])

    const pendingMetadata = mergeMobileTriageMetadata({
      metadata: file.metadata,
      disposition: "pending",
      updatedAt: deps.now(),
    })

    await deps.updateFile(file.id, organizationId, {
      metadata: pendingMetadata,
    })

    let result: Awaited<ReturnType<ReviewActionDependencies["startAnalysisJobAction"]>>
    try {
      result = await deps.startAnalysisJobAction(file, settings, fields, categories, projects)
    } catch (error) {
      await deps.updateFile(file.id, organizationId, {
        metadata: file.metadata,
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : "No se ha podido relanzar el análisis.",
      }
    }

    if (!result.success) {
      await deps.updateFile(file.id, organizationId, {
        metadata: file.metadata,
      })

      return {
        success: false,
        error: result.error || "No se ha podido relanzar el análisis.",
      }
    }

    deps.revalidatePath("/capture/inbox")

    return { success: true }
  }

  async function deferMobileReviewAction(fileId: string): Promise<MobileReviewActionResult> {
    await deps.getCurrentUser()
    const organizationId = await deps.getCurrentOrganizationId()
    const file = await deps.getFileById(fileId, organizationId)

    if (!file) {
      return {
        success: false,
        error: FILE_NOT_FOUND_ERROR,
      }
    }

    if (!isMobileReviewAvailable(file, { allowRetryFromDeferred: true })) {
      return {
        success: false,
        error: REVIEW_NOT_AVAILABLE_ERROR,
      }
    }

    await deps.updateFile(file.id, organizationId, {
      metadata: mergeMobileTriageMetadata({
        metadata: file.metadata,
        disposition: "deferred",
        reasonCode: MOBILE_REASON_CODE.USER_DEFERRED,
        updatedAt: deps.now(),
      }),
    })

    deps.revalidatePath("/capture/inbox")
    deps.revalidatePath("/unsorted")

    return { success: true }
  }

  return {
    acceptMobileReviewAction,
    retryMobileReviewAction,
    deferMobileReviewAction,
  }
}
