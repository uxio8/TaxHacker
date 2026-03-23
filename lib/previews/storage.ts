import path from "node:path"

import { FILE_PREVIEWS_DIRECTORY_NAME, FILE_UPLOAD_PATH, safePathJoin } from "../files.ts"
import { buildOrganizationPreviewObjectKey } from "../storage/keys.ts"
import { resolveStoredFileAbsolutePath } from "../storage/paths.ts"

export type PreviewStorageOwner = {
  id: string
  email: string
}

type PreviewStorageInput = {
  owner: PreviewStorageOwner
  organizationId: string
  fileId: string
}

function getLegacyPreviewsDirectory(owner: PreviewStorageOwner) {
  return safePathJoin(FILE_UPLOAD_PATH, owner.email, FILE_PREVIEWS_DIRECTORY_NAME)
}

function getOwnerUploadsDirectory(owner: PreviewStorageOwner) {
  return safePathJoin(FILE_UPLOAD_PATH, owner.email)
}

export function buildCanonicalPreviewStorageLocation(input: PreviewStorageInput, page: number) {
  const objectKey = buildOrganizationPreviewObjectKey(input.organizationId, input.fileId, page)

  return {
    objectKey,
    absolutePath: resolveStoredFileAbsolutePath({
      storageBasePath: FILE_UPLOAD_PATH,
      ownerUploadsDirectory: getOwnerUploadsDirectory(input.owner),
      storedPath: objectKey,
    }),
  }
}

export function getCanonicalPreviewDirectory(input: PreviewStorageInput) {
  return path.dirname(buildCanonicalPreviewStorageLocation(input, 1).absolutePath)
}

export function buildLegacyImagePreviewAbsolutePath(owner: PreviewStorageOwner, originalFilePath: string) {
  const basename = path.basename(originalFilePath, path.extname(originalFilePath))
  return safePathJoin(getLegacyPreviewsDirectory(owner), `${basename}.webp`)
}

export function buildLegacyPdfPreviewAbsolutePath(
  owner: PreviewStorageOwner,
  originalFilePath: string,
  page: number
) {
  const basename = path.basename(originalFilePath, path.extname(originalFilePath))
  return safePathJoin(getLegacyPreviewsDirectory(owner), `${basename}.${page}.webp`)
}
