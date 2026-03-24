"use server"

import { getCurrentUser, isSubscriptionExpired } from "@/lib/auth"
import {
  getUserUploadsDirectory,
  isEnoughStorageToUploadFile,
} from "@/lib/files"
import { requireCurrentWritableOrganizationId } from "@/lib/tenant"
import { putStoredFileBuffer } from "@/lib/storage/runtime"
import { getAppData, setAppData } from "@/models/apps"
import { getCurrentOrganizationUserBillingProjection } from "@/models/billing/access"
import { buildOrganizationActionUser } from "@/models/billing/runtime"
import { syncOrganizationStorageUsageSnapshot } from "@/models/billing/usage"
import { createFile } from "@/models/files"
import { assertFiscalDocumentsSyncAllowed, ensureFiscalDocumentsSynced } from "@/models/fiscal/sync"
import { createTransaction, updateTransactionFiles } from "@/models/transactions"
import { buildDefaultTransactionUploadTargetFromFilename } from "@/models/upload-targets"
import { Transaction, User } from "@/prisma/client"
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer"
import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import { createElement } from "react"
import { InvoiceFormData } from "./components/invoice-page"
import { InvoicePDF } from "./components/invoice-pdf"
import { InvoiceTemplate } from "./default-templates"
import { InvoiceAppData } from "./page"

export async function generateInvoicePDF(data: InvoiceFormData): Promise<Uint8Array> {
  const pdfElement = createElement(InvoicePDF, { data })
  const buffer = await renderToBuffer(pdfElement as React.ReactElement<DocumentProps>)
  return new Uint8Array(buffer)
}

export async function addNewTemplateAction(_user: User, template: InvoiceTemplate) {
  const user = await getCurrentUser()
  await requireCurrentWritableOrganizationId({
    getCurrentUser: async () => user,
  })
  const appData = (await getAppData(user, "invoices")) as InvoiceAppData | null
  const updatedTemplates = [...(appData?.templates || []), template]
  const appDataResult = await setAppData(user, "invoices", { ...appData, templates: updatedTemplates })
  return { success: true, data: appDataResult }
}

export async function deleteTemplateAction(_user: User, templateId: string) {
  const user = await getCurrentUser()
  await requireCurrentWritableOrganizationId({
    getCurrentUser: async () => user,
  })
  const appData = (await getAppData(user, "invoices")) as InvoiceAppData | null
  if (!appData) return { success: false, error: "No app data found" }

  const updatedTemplates = appData.templates.filter((t) => t.id !== templateId)
  const appDataResult = await setAppData(user, "invoices", { ...appData, templates: updatedTemplates })
  return { success: true, data: appDataResult }
}

export async function saveInvoiceAsTransactionAction(
  formData: InvoiceFormData
): Promise<{ success: boolean; error?: string; data?: Transaction }> {
  try {
    const user = await getCurrentUser()
    const organizationId = await requireCurrentWritableOrganizationId({
      getCurrentUser: async () => user,
    })
    const occurredAt = new Date()
    const billingProjection = await getCurrentOrganizationUserBillingProjection(organizationId)
    const actionUser = buildOrganizationActionUser(
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
    )

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(formData)

    // Calculate total amount from items
    const subtotal = formData.items.reduce((sum, item) => sum + item.subtotal, 0)
    const taxes = formData.additionalTaxes.reduce((sum, tax) => sum + tax.amount, 0)
    const fees = formData.additionalFees.reduce((sum, fee) => sum + fee.amount, 0)
    const totalAmount = (formData.taxIncluded ? subtotal : subtotal + taxes) + fees

    await assertFiscalDocumentsSyncAllowed(user.id, {
      organizationId,
      transactions: [
        buildInvoiceTransactionForFiscalSync(
          {
            id: randomUUID(),
            userId: user.id,
            organizationId,
            name: `Invoice #${formData.invoiceNumber || "unknown"}`,
            description: null,
            merchant: `${formData.billTo.split("\n")[0]}`,
            total: totalAmount * 100,
            currencyCode: formData.currency,
            convertedTotal: null,
            convertedCurrencyCode: null,
            type: "income",
            items: [],
            note: null,
            files: [],
            extra: null,
            categoryCode: null,
            projectCode: null,
            issuedAt: new Date(formData.date),
            createdAt: occurredAt,
            updatedAt: occurredAt,
            text: null,
          },
          formData
        ),
      ],
      actor: {
        type: "user",
        id: user.id,
      },
      occurredAt,
    })

    // Create transaction
    const transaction = await createTransaction(user.id, organizationId, {
      name: `Invoice #${formData.invoiceNumber || "unknown"}`,
      merchant: `${formData.billTo.split("\n")[0]}`,
      total: totalAmount * 100,
      currencyCode: formData.currency,
      issuedAt: new Date(formData.date),
      categoryCode: null,
      projectCode: null,
      type: "income",
      status: "pending",
    })

    // Check storage limits
    if (!(await isEnoughStorageToUploadFile(actionUser, pdfBuffer.length))) {
      return {
        success: false,
        error: "Insufficient storage to save invoice PDF",
      }
    }

    if (isSubscriptionExpired(actionUser)) {
      return {
        success: false,
        error: "Your subscription has expired, please upgrade your account or buy new subscription plan",
      }
    }

    // Save PDF file
    const fileUuid = randomUUID()
    const fileName = buildInvoiceFileName(formData)
    const userUploadsDirectory = getUserUploadsDirectory(user)
    const target = buildDefaultTransactionUploadTargetFromFilename(
      organizationId,
      fileUuid,
      fileName,
      transaction.issuedAt || new Date()
    )
    await putStoredFileBuffer({
      ownerOrganizationId: organizationId,
      ownerUploadsDirectory: userUploadsDirectory,
      storedPath: target.relativePath,
      kind: "transaction",
      contentType: "application/pdf",
      body: Buffer.from(pdfBuffer),
    })

    // Create file record in database
    const fileRecord = await createFile(user.id, {
      id: fileUuid,
      organizationId,
      filename: target.storedFilename,
      path: target.relativePath,
      mimetype: "application/pdf",
      isReviewed: target.isReviewed,
      metadata: {
        size: pdfBuffer.length,
        lastModified: Date.now(),
      },
    })

    // Update transaction with the file ID
    await updateTransactionFiles(transaction.id, organizationId, [fileRecord.id])
    await syncOrganizationStorageUsageSnapshot({
      organizationId,
      userId: user.id,
      userEmailOrId: user.email || user.id,
    })
    await syncFiscalDocumentsAfterWrite(user.id, organizationId, [
      buildInvoiceTransactionForFiscalSync(transaction, formData),
    ])

    revalidatePath("/transactions")

    return { success: true, data: transaction }
  } catch (error) {
    console.error("Failed to save invoice as transaction:", error)
    return {
      success: false,
      error: `Failed to save invoice as transaction: ${error}`,
    }
  }
}

function buildInvoiceFileName(formData: InvoiceFormData) {
  const invoiceNumber = sanitizeFilePart(formData.invoiceNumber)
  const issuedAt = sanitizeDatePart(formData.date)
  const issuer = sanitizeFilePart(formData.companyDetails.split("\n")[0])

  const parts = [invoiceNumber, issuedAt ? `(${issuedAt})` : null, issuer].filter(
    (part): part is string => Boolean(part)
  )

  if (parts.length === 0) {
    return "invoice.pdf"
  }

  return `${parts.join(" ")}.pdf`
}

function sanitizeFilePart(value: string | undefined | null) {
  if (!value) {
    return null
  }

  return value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, "-")
    .replace(/-+/g, "-")
    .trim()
    .replace(/^[.\-\s]+|[.\-\s]+$/g, "")
}

function sanitizeDatePart(value: string | undefined | null) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function buildInvoiceTransactionForFiscalSync(
  transaction: Transaction,
  formData: InvoiceFormData
): Transaction {
  return {
    ...transaction,
    extra: {
      invoice_number: formData.invoiceNumber || null,
    },
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
    console.error("Failed to sync fiscal documents after invoice write:", {
      userId,
      transactionIds: transactions.map((transaction) => transaction.id),
      error,
    })
  }
}
