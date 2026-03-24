import type { UploadTransaction, UploadStorageTarget } from "./uploads.ts"
import { buildOrganizationTransactionObjectKey, buildOrganizationUnsortedObjectKey } from "../lib/storage/keys.ts"
import { buildTransactionFileName } from "../lib/transaction-file-name.ts"

export function buildDefaultUnsortedUploadTarget(
  organizationId: string,
  fileId: string,
  file: File
): UploadStorageTarget {
  return {
    destination: "unsorted",
    storedFilename: file.name,
    relativePath: buildOrganizationUnsortedObjectKey(organizationId, fileId, file.name),
    isReviewed: false,
  }
}

export function buildDefaultTransactionUploadTarget(
  organizationId: string,
  fileId: string,
  file: File,
  transaction: UploadTransaction
): UploadStorageTarget {
  const storedFilename = buildTransactionFileName(file.name, transaction as never) || file.name
  return buildDefaultTransactionUploadTargetFromFilename(
    organizationId,
    fileId,
    storedFilename,
    transaction.issuedAt ? new Date(transaction.issuedAt) : new Date()
  )
}

export function buildDefaultTransactionUploadTargetFromFilename(
  organizationId: string,
  fileId: string,
  storedFilename: string,
  issuedAt: Date
): UploadStorageTarget {
  return {
    destination: "transaction",
    storedFilename,
    relativePath: buildOrganizationTransactionObjectKey(organizationId, fileId, storedFilename, issuedAt),
    isReviewed: true,
  }
}
