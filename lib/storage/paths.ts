import { resolvePathWithinBase } from "../file-security.ts"
import { isCanonicalOrganizationObjectKey } from "./keys.ts"

type ResolveStoredFileAbsolutePathInput = {
  storageBasePath: string
  ownerUploadsDirectory: string
  storedPath: string
}

export function resolveStoredFileAbsolutePath(input: ResolveStoredFileAbsolutePathInput) {
  if (isCanonicalOrganizationObjectKey(input.storedPath)) {
    return resolvePathWithinBase(input.storageBasePath, input.storedPath)
  }

  return resolvePathWithinBase(input.ownerUploadsDirectory, input.storedPath)
}
