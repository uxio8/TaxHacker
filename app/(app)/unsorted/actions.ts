"use server"

import { AnalyzeAttachment, loadAttachmentsForAI } from "@/ai/attachments"
import { buildLLMPrompt } from "@/ai/prompt"
import { fieldsToJsonSchema } from "@/ai/schema"
import { transactionFormSchema } from "@/forms/transactions"
import { ActionState } from "@/lib/actions"
import { canAnalyzeFileMimeType, getAnalyzeMimeTypeError } from "@/lib/analysis-support"
import { ensureAnalysisWorkerRunning } from "@/lib/analysis-worker-supervisor"
import { getCurrentUser, isAiBalanceExhausted, isSubscriptionExpired } from "@/lib/auth"
import { buildReviewedFileUpdate } from "@/lib/mobile-triage"
import { requireCurrentWritableOrganizationId } from "@/lib/tenant"
import {
  getTransactionStoredFilename,
  getUserUploadsDirectory,
} from "@/lib/files"
import {
  moveStoredFile,
  putStoredFileBuffer,
  readStoredFileBuffer,
  storedPathExists,
} from "@/lib/storage/runtime"
import { DEFAULT_PROMPT_ANALYSE_NEW_FILE } from "@/models/defaults"
import { createAnalysisJob, findActiveAnalysisJobForFile } from "@/models/analysis-jobs"
import { getCurrentOrganizationUserBillingProjection } from "@/models/billing/access"
import { syncOrganizationStorageUsageSnapshot } from "@/models/billing/usage"
import { createFile, deleteFile, getFileById, updateFile } from "@/models/files"
import { toStoredAnalysisJobAttachments } from "@/lib/analysis-jobs"
import { getFields } from "@/models/fields"
import {
  assertFiscalDocumentsSyncAllowed,
  buildSyncableTransactionProjection,
  ensureFiscalDocumentsSynced,
  type SyncableTransaction,
} from "@/models/fiscal/sync"
import { getLLMSettings, getSettings } from "@/models/settings"
import {
  buildDefaultTransactionUploadTargetFromFilename,
  buildDefaultUnsortedUploadTarget,
} from "@/models/upload-targets"
import { createTransaction, TransactionData, updateTransactionFiles } from "@/models/transactions"
import { getUserById } from "@/models/users"
import type { Category, Field, File, Project, Transaction } from "@/prisma/client"
import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import path from "path"

export type StartAnalysisJobResult = {
  jobId: string
  status: string
}

async function ensureAnalysisWorkerForJob(jobId: string) {
  try {
    await ensureAnalysisWorkerRunning({ currentJobId: jobId })
  } catch (error) {
    console.error("Failed to ensure analysis worker is running:", { jobId, error })
  }
}

export async function startAnalysisJobAction(
  file: File,
  settings: Record<string, string>,
  fields: Field[],
  categories: Category[],
  projects: Project[]
): Promise<ActionState<StartAnalysisJobResult>> {
  const user = await getCurrentUser()
  const organizationId = await requireCurrentWritableOrganizationId({
    getCurrentUser: async () => user,
  })
  const billingProjection = await getCurrentOrganizationUserBillingProjection(organizationId)
  const storedFile = await getFileById(file.id, organizationId)

  if (!storedFile) {
    return { success: false, error: "File not found or does not belong to the organization" }
  }

  if (!canAnalyzeFileMimeType(storedFile.mimetype)) {
    return {
      success: false,
      error: getAnalyzeMimeTypeError(storedFile.mimetype),
    }
  }

  if (isSubscriptionExpired(billingProjection)) {
    return {
      success: false,
      error: "Your subscription has expired, please upgrade your account or buy new subscription plan",
    }
  }

  if (isAiBalanceExhausted(billingProjection)) {
    return {
      success: false,
      error: "You used all of your pre-paid AI scans, please upgrade your account or buy new subscription plan",
    }
  }

  let attachments: AnalyzeAttachment[] = []
  try {
    const ownerUser = await getUserById(storedFile.userId)
    if (!ownerUser) {
      return { success: false, error: "File owner not found" }
    }

    attachments = await loadAttachmentsForAI(ownerUser, storedFile)
  } catch (error) {
    console.error("Failed to retrieve files:", error)
    return { success: false, error: "Failed to retrieve files: " + error }
  }

  const currentFields = await getFields(organizationId)
  const currentSettings = { ...settings, ...(await getSettings(organizationId)) }

  const prompt = buildLLMPrompt(
    currentSettings.prompt_analyse_new_file || DEFAULT_PROMPT_ANALYSE_NEW_FILE,
    currentFields,
    categories,
    projects,
    {
      businessName: user.businessName,
      businessAddress: user.businessAddress,
      businessTaxId: user.businessTaxId,
    }
  )

  const schema = fieldsToJsonSchema(currentFields)
  const llmSettings = getLLMSettings(currentSettings)

  if (llmSettings.providers.length === 0) {
    return {
      success: false,
      error: "No AI provider is configured for analysis.",
    }
  }

  const activeJob = await findActiveAnalysisJobForFile(user.id, storedFile.id, organizationId)
  if (activeJob) {
    await ensureAnalysisWorkerForJob(activeJob.id)

    return {
      success: true,
      data: {
        jobId: activeJob.id,
        status: activeJob.status,
      },
    }
  }

  const job = await createAnalysisJob(
    user.id,
    storedFile.id,
    {
      prompt,
      schema,
      attachments: toStoredAnalysisJobAttachments(attachments),
      providers: llmSettings.providers,
    },
    organizationId
  )

  await ensureAnalysisWorkerForJob(job.id)

  return {
    success: true,
    data: {
      jobId: job.id,
      status: job.status,
    },
  }
}

export async function saveFileAsTransactionAction(
  _prevState: ActionState<Transaction> | null,
  formData: FormData
): Promise<ActionState<Transaction>> {
  try {
    const user = await getCurrentUser()
    const validatedForm = transactionFormSchema.safeParse(Object.fromEntries(formData.entries()))

    if (!validatedForm.success) {
      return { success: false, error: validatedForm.error.message }
    }

    const organizationId = await requireCurrentWritableOrganizationId({
      getCurrentUser: async () => user,
    })

    // Get the file record
    const fileId = formData.get("fileId") as string
    const file = await getFileById(fileId, organizationId)
    if (!file) throw new Error("File not found")
    const ownerUser = await getUserById(file.userId)
    if (!ownerUser) throw new Error("File owner not found")

    await assertFiscalSyncAllowedBeforeWrite(user.id, organizationId, [
      buildSyncableTransactionProjection({
        id: randomUUID(),
        userId: user.id,
        data: validatedForm.data as Record<string, unknown>,
        defaultType: "expense",
      }),
    ])
    // Create transaction
    const transaction = await createTransaction(user.id, organizationId, validatedForm.data)

    // Move file to processed location
    const userUploadsDirectory = getUserUploadsDirectory(user)
    const storedFilename = getTransactionStoredFilename(file.filename, transaction) || path.basename(file.path)
    const { filename: finalFilename, path: newRelativeFilePath } = await resolveTransactionFileDestination(
      organizationId,
      file.id,
      userUploadsDirectory,
      storedFilename,
      transaction
    )

    // Move file to new location and name
    await moveStoredFile({
      ownerOrganizationId: file.organizationId,
      ownerUploadsDirectory: getUserUploadsDirectory(ownerUser),
      storedPath: file.path,
      nextStoredPath: newRelativeFilePath,
    })

    // Update file record
    await updateFile(
      file.id,
      organizationId,
      buildReviewedFileUpdate({
        filename: finalFilename,
        path: newRelativeFilePath,
        metadata: file.metadata,
      })
    )

    await updateTransactionFiles(transaction.id, organizationId, [file.id])
    await syncFiscalDocumentsAfterWrite(user.id, organizationId, [transaction])

    revalidatePath("/unsorted")
    revalidatePath("/transactions")

    return { success: true, data: transaction }
  } catch (error) {
    console.error("Failed to save transaction:", error)
    return { success: false, error: `Failed to save transaction: ${error}` }
  }
}

export async function resolveTransactionFileDestination(
  organizationId: string,
  fileId: string,
  userUploadsDirectory: string,
  storedFilename: string,
  transaction: Transaction
) {
  let filename = storedFilename
  let relativePath = buildDefaultTransactionUploadTargetFromFilename(
    organizationId,
    fileId,
    filename,
    transaction.issuedAt || new Date()
  ).relativePath
  let collisionIndex = 1

  while (
    await storedPathExists({
      ownerOrganizationId: organizationId,
      ownerUploadsDirectory: userUploadsDirectory,
      storedPath: relativePath,
    })
  ) {
    filename = addFilenameSuffix(storedFilename, collisionIndex)
    relativePath = buildDefaultTransactionUploadTargetFromFilename(
      organizationId,
      fileId,
      filename,
      transaction.issuedAt || new Date()
    ).relativePath
    collisionIndex += 1
  }

  return { filename, path: relativePath }
}

function addFilenameSuffix(filename: string, suffix: number) {
  const extension = path.extname(filename)
  const baseName = path.basename(filename, extension)
  return `${baseName}-${suffix}${extension}`
}

async function syncFiscalDocumentsAfterWrite(
  userId: string,
  organizationId: string,
  transactions: Transaction[]
) {
  try {
    await ensureFiscalDocumentsSynced(userId, {
      organizationId,
      transactions,
    })
  } catch (error) {
    console.error("Failed to sync fiscal documents after unsorted write:", {
      userId,
      transactionIds: transactions.map((transaction) => transaction.id),
      error,
    })
  }
}

async function assertFiscalSyncAllowedBeforeWrite(
  userId: string,
  organizationId: string,
  transactions: SyncableTransaction[],
  deleteMode = false
) {
  await assertFiscalDocumentsSyncAllowed(userId, {
    organizationId,
    transactions,
    deleteMode,
    actor: {
      type: "user",
      id: userId,
    },
  })
}

export async function deleteUnsortedFileAction(
  _prevState: ActionState<Transaction> | null,
  fileId: string
): Promise<ActionState<Transaction>> {
  try {
    const user = await getCurrentUser()
    const organizationId = await requireCurrentWritableOrganizationId({
      getCurrentUser: async () => user,
    })
    await deleteFile(fileId, organizationId)
    revalidatePath("/unsorted")
    return { success: true }
  } catch (error) {
    console.error("Failed to delete file:", error)
    return { success: false, error: "Failed to delete file" }
  }
}

export async function splitFileIntoItemsAction(
  _prevState: ActionState<null> | null,
  formData: FormData
): Promise<ActionState<null>> {
  try {
    const user = await getCurrentUser()
    const organizationId = await requireCurrentWritableOrganizationId({
      getCurrentUser: async () => user,
    })
    const fileId = formData.get("fileId") as string
    const items = JSON.parse(formData.get("items") as string) as TransactionData[]

    if (!fileId || !items || items.length === 0) {
      return { success: false, error: "File ID and items are required" }
    }

    // Get the original file
    const originalFile = await getFileById(fileId, organizationId)
    if (!originalFile) {
      return { success: false, error: "Original file not found" }
    }
    const ownerUser = await getUserById(originalFile.userId)
    if (!ownerUser) {
      return { success: false, error: "Original file owner not found" }
    }

    // Get the original file's content
    const userUploadsDirectory = getUserUploadsDirectory(user)
    const fileContent = await readStoredFileBuffer({
      ownerOrganizationId: originalFile.organizationId,
      ownerUploadsDirectory: getUserUploadsDirectory(ownerUser),
      storedPath: originalFile.path,
    })

    // Create a new file for each item
    for (const item of items) {
      const fileUuid = randomUUID()
      const fileName = `${originalFile.filename}-part-${item.name}`
      const target = buildDefaultUnsortedUploadTarget(organizationId, fileUuid, new File([], fileName))
      await putStoredFileBuffer({
        ownerOrganizationId: organizationId,
        ownerUploadsDirectory: userUploadsDirectory,
        storedPath: target.relativePath,
        kind: "unsorted",
        contentType: originalFile.mimetype,
        body: fileContent,
      })

      // Create file record in database with the item data cached
      await createFile(user.id, {
        id: fileUuid,
        organizationId,
        filename: target.storedFilename,
        path: target.relativePath,
        mimetype: originalFile.mimetype,
        metadata: originalFile.metadata,
        isSplitted: true,
        cachedParseResult: {
          name: item.name,
          merchant: item.merchant,
          description: item.description,
          total: item.total,
          currencyCode: item.currencyCode,
          categoryCode: item.categoryCode,
          projectCode: item.projectCode,
          type: item.type,
          issuedAt: item.issuedAt,
          note: item.note,
          text: item.text,
        },
      })
    }

    // Delete the original file
    await deleteFile(fileId, organizationId)

    // Update user storage used
    await syncOrganizationStorageUsageSnapshot({
      organizationId,
      userId: user.id,
      userEmailOrId: user.email || user.id,
    })

    revalidatePath("/unsorted")
    return { success: true }
  } catch (error) {
    console.error("Failed to split file into items:", error)
    return { success: false, error: `Failed to split file into items: ${error}` }
  }
}
