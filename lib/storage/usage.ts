import path from "node:path"

import { getOrganizationStoragePrefix } from "./types.ts"

type BuildStorageUsageDirectoriesInput = {
  storageBasePath: string
  organizationId: string
  legacyUserNamespaces?: Array<string | null | undefined>
}

export function buildStorageUsageDirectories(input: BuildStorageUsageDirectoriesInput) {
  const directories = [
    path.resolve(input.storageBasePath, getOrganizationStoragePrefix(input.organizationId)),
  ]

  for (const namespace of normalizeLegacyUserNamespaces(input.legacyUserNamespaces)) {
    directories.push(path.resolve(input.storageBasePath, namespace))
  }

  return Array.from(new Set(directories))
}

export function buildLegacyStorageUsageDirectories(input: BuildStorageUsageDirectoriesInput) {
  const canonicalDirectory = path.resolve(
    input.storageBasePath,
    getOrganizationStoragePrefix(input.organizationId)
  )

  return buildStorageUsageDirectories(input).filter((directoryPath) => directoryPath !== canonicalDirectory)
}

export function normalizeLegacyUserNamespaces(
  namespaces: Array<string | null | undefined> | undefined
) {
  return Array.from(
    new Set(
      (namespaces || [])
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  )
}
