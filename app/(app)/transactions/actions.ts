"use server"

import { transactionFormSchema } from "@/forms/transactions"
import { ActionState } from "@/lib/actions"
import { getCurrentUser } from "@/lib/auth"
import { requireCurrentWritableOrganizationId } from "@/lib/tenant"
import { getCurrentOrganizationUserBillingProjection } from "@/models/billing/access"
import { buildOrganizationActionUser } from "@/models/billing/runtime"
import { updateField } from "@/models/fields"
import { syncOrganizationStorageUsageSnapshot } from "@/models/billing/usage"
import { deleteFile } from "@/models/files"
import {
  bulkDeleteTransactions,
  createTransaction,
  deleteTransaction,
  getTransactionById,
  updateTransaction,
  updateTransactionFiles,
} from "@/models/transactions"
import {
  assertFiscalDocumentsSyncAllowed,
  buildSyncableTransactionProjection,
  ensureFiscalDocumentsSynced,
  type SyncableTransaction,
} from "@/models/fiscal/sync"
import { uploadFiles } from "@/models/uploads"
import { Transaction } from "@/prisma/client"
import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"

export async function createTransactionAction(
  _prevState: ActionState<Transaction> | null,
  formData: FormData
): Promise<ActionState<Transaction>> {
  try {
    const user = await getCurrentUser()
    const organizationId = await requireCurrentWritableOrganizationId({
      getCurrentUser: async () => user,
    })
    const validatedForm = transactionFormSchema.safeParse(Object.fromEntries(formData.entries()))

    if (!validatedForm.success) {
      return { success: false, error: validatedForm.error.message }
    }

    await assertFiscalSyncAllowedBeforeWrite(user.id, organizationId, [
      buildSyncableTransactionProjection({
        id: randomUUID(),
        userId: user.id,
        data: validatedForm.data as Record<string, unknown>,
        defaultType: "expense",
      }),
    ])

    const transaction = await createTransaction(user.id, organizationId, validatedForm.data)
    await syncFiscalDocumentsAfterWrite(user.id, organizationId, [transaction])

    revalidatePath("/transactions")
    return { success: true, data: transaction }
  } catch (error) {
    console.error("Failed to create transaction:", error)
    return { success: false, error: "No se ha podido crear la transacción" }
  }
}

export async function saveTransactionAction(
  _prevState: ActionState<Transaction> | null,
  formData: FormData
): Promise<ActionState<Transaction>> {
  try {
    const user = await getCurrentUser()
    const organizationId = await requireCurrentWritableOrganizationId({
      getCurrentUser: async () => user,
    })
    const transactionId = formData.get("transactionId") as string
    const validatedForm = transactionFormSchema.safeParse(Object.fromEntries(formData.entries()))

    if (!validatedForm.success) {
      return { success: false, error: validatedForm.error.message }
    }

    const currentTransaction = await getTransactionById(transactionId, organizationId)
    if (!currentTransaction) {
      return { success: false, error: "No se ha encontrado la transacción" }
    }

    await assertFiscalSyncAllowedBeforeWrite(user.id, organizationId, [
      buildSyncableTransactionProjection({
        id: currentTransaction.id,
        userId: user.id,
        current: currentTransaction,
        data: validatedForm.data as Record<string, unknown>,
      }),
    ])

    const transaction = await updateTransaction(transactionId, organizationId, validatedForm.data)
    await syncFiscalDocumentsAfterWrite(user.id, organizationId, [transaction])

    revalidatePath("/transactions")
    return { success: true, data: transaction }
  } catch (error) {
    console.error("Failed to update transaction:", error)
    return { success: false, error: "No se ha podido guardar la transacción" }
  }
}

export async function deleteTransactionAction(
  _prevState: ActionState<Transaction> | null,
  transactionId: string
): Promise<ActionState<Transaction>> {
  try {
    const user = await getCurrentUser()
    const organizationId = await requireCurrentWritableOrganizationId({
      getCurrentUser: async () => user,
    })
    const transaction = await getTransactionById(transactionId, organizationId)
    if (!transaction) throw new Error("No se ha encontrado la transacción")

    await assertFiscalSyncAllowedBeforeWrite(user.id, organizationId, [transaction], true)
    await deleteTransaction(transaction.id, organizationId)

    revalidatePath("/transactions")

    return { success: true, data: transaction }
  } catch (error) {
    console.error("Failed to delete transaction:", error)
    return { success: false, error: "No se ha podido eliminar la transacción" }
  }
}

export async function deleteTransactionFileAction(
  transactionId: string,
  fileId: string
): Promise<ActionState<Transaction>> {
  if (!fileId || !transactionId) {
    return { success: false, error: "El ID del archivo y el de la transacción son obligatorios" }
  }

  const user = await getCurrentUser()
  const organizationId = await requireCurrentWritableOrganizationId({
    getCurrentUser: async () => user,
  })
  const transaction = await getTransactionById(transactionId, organizationId)
  if (!transaction) {
    return { success: false, error: "No se ha encontrado la transacción" }
  }

  await updateTransactionFiles(
    transactionId,
    organizationId,
    transaction.files ? (transaction.files as string[]).filter((id) => id !== fileId) : []
  )

  await deleteFile(fileId, organizationId)

  // Update user storage used
  await syncOrganizationStorageUsageSnapshot({
    organizationId,
    userId: user.id,
    userEmailOrId: user.email || user.id,
  })

  revalidatePath(`/transactions/${transactionId}`)
  return { success: true, data: transaction }
}

export async function uploadTransactionFilesAction(formData: FormData): Promise<ActionState<Transaction>> {
  try {
    const transactionId = formData.get("transactionId") as string
    const files = formData.getAll("files") as File[]

    if (!files || !transactionId) {
      return { success: false, error: "Faltan los archivos o el ID de la transacción" }
    }

    const user = await getCurrentUser()
    const organizationId = await requireCurrentWritableOrganizationId({
      getCurrentUser: async () => user,
    })
    const transaction = await getTransactionById(transactionId, organizationId)
    if (!transaction) {
      return { success: false, error: "No se ha encontrado la transacción" }
    }
    const billingProjection = await getCurrentOrganizationUserBillingProjection(organizationId)
    const result = await uploadFiles({
      user: buildOrganizationActionUser(
        {
          id: user.id,
          email: user.email,
        },
        {
          organizationId,
          storageLimit: billingProjection.storageLimit,
          storageUsed: billingProjection.storageUsed,
          membershipExpiresAt: billingProjection.membershipExpiresAt,
          accessStatus: billingProjection.accessStatus,
        }
      ),
      files,
      transactionId,
    })

    if (!result.success) {
      return { success: false, error: result.error }
    }

    revalidatePath(`/transactions/${transactionId}`)
    return { success: true }
  } catch (error) {
    console.error("Upload error:", error)
    return { success: false, error: `La subida de archivos ha fallado: ${error}` }
  }
}

export async function bulkDeleteTransactionsAction(transactionIds: string[]) {
  try {
    const user = await getCurrentUser()
    const organizationId = await requireCurrentWritableOrganizationId({
      getCurrentUser: async () => user,
    })
    const transactions = (
      await Promise.all(
        transactionIds.map((transactionId) => getTransactionById(transactionId, organizationId))
      )
    ).filter((transaction): transaction is Transaction => Boolean(transaction))

    await assertFiscalSyncAllowedBeforeWrite(user.id, organizationId, transactions, true)
    await bulkDeleteTransactions(transactionIds, organizationId)
    revalidatePath("/transactions")
    return { success: true }
  } catch (error) {
    console.error("Failed to delete transactions:", error)
    return { success: false, error: "No se han podido eliminar las transacciones" }
  }
}

export async function updateFieldVisibilityAction(fieldCode: string, isVisible: boolean) {
  try {
    const user = await getCurrentUser()
    const organizationId = await requireCurrentWritableOrganizationId({
      getCurrentUser: async () => user,
    })
    await updateField(organizationId, fieldCode, {
      isVisibleInList: isVisible,
    })
    return { success: true }
  } catch (error) {
    console.error("Failed to update field visibility:", error)
    return { success: false, error: "No se ha podido actualizar la visibilidad de la columna" }
  }
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
    console.error("Failed to sync fiscal documents after transaction write:", {
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
