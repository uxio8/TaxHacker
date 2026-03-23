import fs from "node:fs/promises"
import path from "node:path"
import lookup from "mime-types"
import { NextResponse } from "next/server.js"

type StaticRouteUser = {
  id: string
  email: string
}

type StaticRouteDependencies = {
  getCurrentUser?: () => Promise<StaticRouteUser>
  requireCurrentOrganizationId?: (input: { getCurrentUser: () => Promise<StaticRouteUser> }) => Promise<string>
  getUserUploadsDirectory?: (user: StaticRouteUser) => string
  getStaticDirectory?: (user: StaticRouteUser) => string
  safePathJoin?: (basePath: string, ...paths: string[]) => string
  isCanonicalOrganizationObjectKey?: (objectKey: string) => boolean
  storedPathExists?: (input: {
    ownerOrganizationId: string
    ownerUploadsDirectory: string
    storedPath: string
  }) => Promise<boolean>
  readStoredFileBuffer?: (input: {
    ownerOrganizationId: string
    ownerUploadsDirectory: string
    storedPath: string
  }) => Promise<Buffer>
  fileExists?: (filePath: string) => Promise<boolean>
  readFile?: typeof fs.readFile
}

async function resolveDependencies(
  dependencies: StaticRouteDependencies
): Promise<Required<StaticRouteDependencies>> {
  const [authModule, tenantModule, filesModule, storageKeysModule, storageRuntimeModule] = await Promise.all([
    dependencies.getCurrentUser ? null : import("../../../../../lib/auth.ts"),
    dependencies.requireCurrentOrganizationId ? null : import("../../../../../lib/tenant.ts"),
    dependencies.getUserUploadsDirectory && dependencies.getStaticDirectory && dependencies.safePathJoin && dependencies.fileExists
      ? null
      : import("../../../../../lib/files.ts"),
    dependencies.isCanonicalOrganizationObjectKey ? null : import("../../../../../lib/storage/keys.ts"),
    dependencies.storedPathExists && dependencies.readStoredFileBuffer ? null : import("../../../../../lib/storage/runtime.ts"),
  ])

  return {
    getCurrentUser: dependencies.getCurrentUser ?? authModule!.getCurrentUser,
    requireCurrentOrganizationId:
      dependencies.requireCurrentOrganizationId
      ?? ((input) => tenantModule!.requireCurrentOrganizationId(input as never)),
    getUserUploadsDirectory:
      dependencies.getUserUploadsDirectory
      ?? ((user) => filesModule!.getUserUploadsDirectory(user as never)),
    getStaticDirectory: dependencies.getStaticDirectory ?? ((user) => filesModule!.getStaticDirectory(user as never)),
    safePathJoin: dependencies.safePathJoin ?? filesModule!.safePathJoin,
    isCanonicalOrganizationObjectKey:
      dependencies.isCanonicalOrganizationObjectKey ?? storageKeysModule!.isCanonicalOrganizationObjectKey,
    storedPathExists: dependencies.storedPathExists ?? ((input) => storageRuntimeModule!.storedPathExists(input)),
    readStoredFileBuffer:
      dependencies.readStoredFileBuffer ?? ((input) => storageRuntimeModule!.readStoredFileBuffer(input)),
    fileExists: dependencies.fileExists ?? filesModule!.fileExists,
    readFile: dependencies.readFile ?? fs.readFile,
  }
}

function getContentType(filename: string) {
  return lookup.lookup(filename) || "application/octet-stream"
}

function belongsToOrganization(objectKey: string, organizationId: string) {
  return objectKey.startsWith(`organizations/${organizationId}/`)
}

export function createStaticFileRoute(dependencies: StaticRouteDependencies = {}) {
  return async function GET(
    _request: Request,
    context: { params: Promise<{ filename?: string[] }> }
  ) {
    const deps = await resolveDependencies(dependencies)
    const filenameSegments = (await context.params).filename ?? []
    const requestedPath = filenameSegments.join("/")
    const user = await deps.getCurrentUser()
    const organizationId = await deps.requireCurrentOrganizationId({
      getCurrentUser: async () => user,
    })

    if (!requestedPath) {
      return new NextResponse("No filename provided", { status: 400 })
    }

    try {
      if (deps.isCanonicalOrganizationObjectKey(requestedPath)) {
        if (!belongsToOrganization(requestedPath, organizationId)) {
          return new NextResponse("File not found", { status: 404 })
        }

        const ownerUploadsDirectory = deps.getUserUploadsDirectory(user)
        const fileExists = await deps.storedPathExists({
          ownerOrganizationId: organizationId,
          ownerUploadsDirectory,
          storedPath: requestedPath,
        })

        if (!fileExists) {
          return new NextResponse("File not found", { status: 404 })
        }

        const fileBuffer = await deps.readStoredFileBuffer({
          ownerOrganizationId: organizationId,
          ownerUploadsDirectory,
          storedPath: requestedPath,
        })

        return new NextResponse(fileBuffer, {
          headers: {
            "Content-Type": getContentType(path.basename(requestedPath)),
          },
        })
      }

      if (filenameSegments.length !== 1) {
        return new NextResponse("File not found", { status: 404 })
      }

      const fullFilePath = deps.safePathJoin(deps.getStaticDirectory(user), filenameSegments[0])
      const fileExists = await deps.fileExists(fullFilePath)

      if (!fileExists) {
        return new NextResponse(`File not found for user: ${filenameSegments[0]}`, { status: 404 })
      }

      const fileBuffer = await deps.readFile(fullFilePath)
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": getContentType(filenameSegments[0]),
        },
      })
    } catch (error) {
      console.error("Error serving file:", error)
      return new NextResponse("Internal Server Error", { status: 500 })
    }
  }
}
