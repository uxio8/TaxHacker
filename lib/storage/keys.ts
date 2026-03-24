import path from "node:path"

import { resolveRelativePath } from "../file-security.ts"

function sanitizeStorageNamePart(value: string) {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeExtension(filename: string) {
  return path.extname(filename).toLowerCase()
}

export function buildOrganizationStoragePrefix(organizationId: string) {
  return resolveRelativePath("organizations", organizationId)
}

export function buildOrganizationUnsortedObjectKey(
  organizationId: string,
  fileId: string,
  filename: string
) {
  return resolveRelativePath(
    buildOrganizationStoragePrefix(organizationId),
    "uploads",
    "unsorted",
    `${fileId}${normalizeExtension(filename)}`
  )
}

export function buildOrganizationTransactionObjectKey(
  organizationId: string,
  fileId: string,
  storedFilename: string,
  issuedAt: Date
) {
  const year = String(issuedAt.getFullYear())
  const month = String(issuedAt.getMonth() + 1).padStart(2, "0")

  return resolveRelativePath(
    buildOrganizationStoragePrefix(organizationId),
    "uploads",
    "transactions",
    fileId,
    year,
    month,
    sanitizeStorageNamePart(storedFilename)
  )
}

export function buildOrganizationPreviewObjectKey(organizationId: string, fileId: string, page: number) {
  return resolveRelativePath(
    buildOrganizationStoragePrefix(organizationId),
    "derived",
    "previews",
    fileId,
    `${page}.webp`
  )
}

export function buildOrganizationStaticObjectKey(
  organizationId: string,
  assetType: string,
  assetId: string,
  filename: string
) {
  return resolveRelativePath(
    buildOrganizationStoragePrefix(organizationId),
    "static",
    sanitizeStorageNamePart(assetType),
    `${sanitizeStorageNamePart(assetId)}${normalizeExtension(filename)}`
  )
}

export function isCanonicalOrganizationObjectKey(objectKey: string) {
  try {
    const normalizedObjectKey = resolveRelativePath(objectKey)
    const [root, organizationId, ...rest] = normalizedObjectKey.split("/")

    return root === "organizations" && Boolean(organizationId) && rest.length > 0
  } catch {
    return false
  }
}
