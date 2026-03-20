import path from "path"

export function resolvePathWithinBase(basePath: string, ...paths: string[]) {
  const normalizedBasePath = path.resolve(basePath)
  const resolvedPath = path.resolve(normalizedBasePath, ...paths)

  if (resolvedPath !== normalizedBasePath && !resolvedPath.startsWith(`${normalizedBasePath}${path.sep}`)) {
    throw new Error("Path traversal detected")
  }

  return resolvedPath
}

export function resolveRelativePath(...paths: string[]) {
  const normalizedSegments = paths.map((segment) => segment.replaceAll("\\", "/"))
  const hasParentTraversal = normalizedSegments.some((segment) =>
    segment.split("/").some((part) => part === "..")
  )

  if (hasParentTraversal) {
    throw new Error("Invalid relative path")
  }

  const normalizedRelativePath = path.posix.normalize(path.posix.join(...normalizedSegments))

  if (
    !normalizedRelativePath ||
    normalizedRelativePath === "." ||
    normalizedRelativePath === ".." ||
    normalizedRelativePath.startsWith("../") ||
    path.posix.isAbsolute(normalizedRelativePath)
  ) {
    throw new Error("Invalid relative path")
  }

  return normalizedRelativePath
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
