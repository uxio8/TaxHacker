import fs from "fs/promises"
import path from "path"
import { NextResponse } from "next/server.js"

import { isCanonicalOrganizationObjectKey } from "../../../../../lib/storage/keys.ts"
import { encodeFilename } from "../../../../../lib/utils.ts"
type PreviewRouteDependencies = {
  getCurrentUser?: () => Promise<unknown>
  requireCurrentOrganizationId?: (input: { getCurrentUser: () => Promise<unknown> }) => Promise<string>
  getFileById?: (fileId: string, organizationId: string) => Promise<{
    id: string
    organizationId: string
    userId: string
    path: string
    mimetype: string
  } | null>
  getUserById?: (userId: string) => Promise<{ id: string; email: string } | null>
  getUserUploadsDirectory?: (ownerUser: unknown) => string
  materializeStoredFileToLocalPath?: (input: {
    ownerOrganizationId: string
    ownerUploadsDirectory: string
    storedPath: string
  }) => Promise<{ path: string; cleanup: () => Promise<void> }>
  readStoredFileBuffer?: (input: {
    ownerOrganizationId: string
    ownerUploadsDirectory: string
    storedPath: string
  }) => Promise<Buffer>
  generateFilePreviews?: (
    ownerUser: unknown,
    organizationId: string,
    fileId: string,
    fullFilePath: string,
    mimetype: string
  ) => Promise<{ contentType: string; previews: string[] }>
  readFile?: typeof fs.readFile
}

async function resolveDependencies(
  dependencies: PreviewRouteDependencies
): Promise<Required<PreviewRouteDependencies>> {
  const [
    authModule,
    tenantModule,
    filesModule,
    storageRuntimeModule,
    previewsModule,
    fileModelModule,
    usersModule,
  ] = await Promise.all([
    dependencies.getCurrentUser ? null : import("../../../../../lib/auth.ts"),
    dependencies.requireCurrentOrganizationId ? null : import("../../../../../lib/tenant.ts"),
    dependencies.getUserUploadsDirectory ? null : import("../../../../../lib/files.ts"),
    dependencies.materializeStoredFileToLocalPath ? null : import("../../../../../lib/storage/runtime.ts"),
    dependencies.generateFilePreviews ? null : import("../../../../../lib/previews/generate.ts"),
    dependencies.getFileById ? null : import("../../../../../models/files.ts"),
    dependencies.getUserById ? null : import("../../../../../models/users.ts"),
  ])

  return {
    getCurrentUser: dependencies.getCurrentUser ?? authModule!.getCurrentUser,
    requireCurrentOrganizationId:
      dependencies.requireCurrentOrganizationId
      ?? ((input) => tenantModule!.requireCurrentOrganizationId(input as never)),
    getFileById: dependencies.getFileById ?? fileModelModule!.getFileById,
    getUserById: dependencies.getUserById ?? usersModule!.getUserById,
    getUserUploadsDirectory:
      dependencies.getUserUploadsDirectory
      ?? ((ownerUser) => filesModule!.getUserUploadsDirectory(ownerUser as never)),
    materializeStoredFileToLocalPath:
      dependencies.materializeStoredFileToLocalPath
      ?? ((input) => storageRuntimeModule!.materializeStoredFileToLocalPath(input)),
    readStoredFileBuffer:
      dependencies.readStoredFileBuffer ?? ((input) => storageRuntimeModule!.readStoredFileBuffer(input)),
    generateFilePreviews:
      dependencies.generateFilePreviews
      ?? ((ownerUser, organizationId, fileId, fullFilePath, mimetype) =>
        previewsModule!.generateFilePreviews(ownerUser as never, organizationId, fileId, fullFilePath, mimetype)),
    readFile: dependencies.readFile ?? fs.readFile,
  }
}

export function createFilePreviewRoute(dependencies: PreviewRouteDependencies = {}) {
  return async function GET(request: Request, context: { params: Promise<{ fileId: string }> }) {
    const deps = await resolveDependencies(dependencies)
    const { fileId } = await context.params
    const user = await deps.getCurrentUser()
    const organizationId = await deps.requireCurrentOrganizationId({
      getCurrentUser: async () => user,
    })

    if (!fileId) {
      return new NextResponse("No fileId provided", { status: 400 })
    }

    const url = new URL(request.url)
    const page = Number.parseInt(url.searchParams.get("page") || "1", 10)

    try {
      const file = await deps.getFileById(fileId, organizationId)
      if (!file) {
        return new NextResponse("File not found", { status: 404 })
      }

      const ownerUser = await deps.getUserById(file.userId)
      if (!ownerUser) {
        return new NextResponse("File owner not found", { status: 404 })
      }

      const materializedFile = await deps.materializeStoredFileToLocalPath({
        ownerOrganizationId: file.organizationId,
        ownerUploadsDirectory: deps.getUserUploadsDirectory(ownerUser),
        storedPath: file.path,
      })

      try {
        const { contentType, previews } = await deps.generateFilePreviews(
          ownerUser,
          file.organizationId,
          file.id,
          materializedFile.path,
          file.mimetype
        )

        if (page > previews.length) {
          return new NextResponse("Page not found", { status: 404 })
        }

        const previewPath = previews[page - 1] || materializedFile.path
        const fileBuffer = isCanonicalOrganizationObjectKey(previewPath)
          ? await deps.readStoredFileBuffer({
            ownerOrganizationId: file.organizationId,
            ownerUploadsDirectory: deps.getUserUploadsDirectory(ownerUser),
            storedPath: previewPath,
          })
          : await deps.readFile(previewPath)

        return new NextResponse(fileBuffer, {
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": `inline; filename*=${encodeFilename(path.basename(previewPath))}`,
          },
        })
      } finally {
        await materializedFile.cleanup()
      }
    } catch (error) {
      console.error("Error serving file:", error)
      return new NextResponse("Internal Server Error", { status: 500 })
    }
  }
}
