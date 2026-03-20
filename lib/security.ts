import { createHmac, timingSafeEqual } from "crypto"
import path from "path"

export const SELF_HOSTED_ACCESS_COOKIE_NAME = "taxhacker_self_hosted_access"

export function resolvePathWithinBase(basePath: string, ...paths: string[]) {
  const normalizedBasePath = path.resolve(basePath)
  const resolvedPath = path.resolve(normalizedBasePath, ...paths)

  if (resolvedPath !== normalizedBasePath && !resolvedPath.startsWith(`${normalizedBasePath}${path.sep}`)) {
    throw new Error("Path traversal detected")
  }

  return resolvedPath
}

export function normalizeBackupFilePath(filePath: string) {
  const normalizedInputPath = filePath.replaceAll("\\", "/")
  const strippedUploadsPrefix = normalizedInputPath.replace(/^.*\/uploads\//, "").replace(/^\/+/, "")
  const normalizedRelativePath = path.posix.normalize(strippedUploadsPrefix)
  const pathSegments = normalizedRelativePath.split("/").filter(Boolean)

  if (pathSegments[0]?.includes("@")) {
    pathSegments.shift()
  }

  const cleanedRelativePath = pathSegments.join("/")

  if (
    !cleanedRelativePath ||
    cleanedRelativePath === "." ||
    cleanedRelativePath === ".." ||
    cleanedRelativePath.startsWith("../") ||
    path.posix.isAbsolute(cleanedRelativePath)
  ) {
    throw new Error("Invalid backup file path")
  }

  return cleanedRelativePath
}

export function buildSelfHostedAccessCookieValue(adminToken: string, authSecret: string) {
  return createHmac("sha256", authSecret).update(adminToken).digest("hex")
}

export function hasSelfHostedAccess(
  cookieValue: string | null | undefined,
  adminToken: string | null | undefined,
  authSecret: string
) {
  if (!cookieValue || !adminToken) {
    return false
  }

  const expectedValue = buildSelfHostedAccessCookieValue(adminToken, authSecret)
  const cookieBuffer = Buffer.from(cookieValue)
  const expectedBuffer = Buffer.from(expectedValue)

  if (cookieBuffer.length !== expectedBuffer.length) {
    return false
  }

  return timingSafeEqual(cookieBuffer, expectedBuffer)
}
