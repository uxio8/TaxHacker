import path from "path"

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
