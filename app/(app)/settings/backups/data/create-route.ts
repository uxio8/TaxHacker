import { NextResponse } from "next/server.js"
import JSZip from "jszip"
import config from "@/lib/config"

import { buildBackupStoredEntries } from "../storage.ts"

const BACKUP_VERSION = "1.0"
const PROGRESS_UPDATE_INTERVAL_MS = 2000

type BackupRouteUser = {
  id: string
  defaultOrganizationId: string | null
}

type BackupRouteSetting = {
  filename: string
  model: unknown
  backup: unknown
  restore: unknown
}

type BackupDataRouteDependencies = {
  getCurrentUser?: () => Promise<BackupRouteUser>
  requireCurrentTenantAdmin?: (input: {
    getCurrentUser: () => Promise<BackupRouteUser>
  }) => Promise<unknown>
  requireCurrentOrganizationId?: (input: {
    getCurrentUser: () => Promise<BackupRouteUser>
  }) => Promise<string>
  modelToJSON?: (
    context: {
      userId: string
      organizationId: string
    },
    backup: BackupRouteSetting
  ) => Promise<string>
  modelBackup?: BackupRouteSetting[]
  listFilesByOrganization?: (organizationId: string) => Promise<
    Array<{
      id: string
      userId: string
      organizationId: string
      path: string
      mimetype: string
    }>
  >
  buildBackupStoredEntries?: typeof buildBackupStoredEntries
  updateProgress?: (
    userId: string,
    progressId: string,
    data: Record<string, unknown>,
    organizationId?: string
  ) => Promise<unknown>
}

async function resolveDependencies(
  dependencies: BackupDataRouteDependencies
): Promise<Required<BackupDataRouteDependencies>> {
  const [authModule, dbModule, tenantModule, backupModule, progressModule] = await Promise.all([
    dependencies.getCurrentUser ? null : import("../../../../../lib/auth.ts"),
    dependencies.listFilesByOrganization ? null : import("../../../../../lib/db.ts"),
    dependencies.requireCurrentTenantAdmin || dependencies.requireCurrentOrganizationId
      ? null
      : import("../../../../../lib/tenant.ts"),
    dependencies.modelToJSON && dependencies.modelBackup
      ? null
      : import("../../../../../models/backups.ts"),
    dependencies.updateProgress ? null : import("../../../../../models/progress.ts"),
  ])

  return {
    getCurrentUser: (dependencies.getCurrentUser ?? authModule!.getCurrentUser) as Required<
      BackupDataRouteDependencies
    >["getCurrentUser"],
    requireCurrentTenantAdmin: (
      dependencies.requireCurrentTenantAdmin ?? tenantModule!.requireCurrentTenantAdmin
    ) as Required<BackupDataRouteDependencies>["requireCurrentTenantAdmin"],
    requireCurrentOrganizationId: (
      dependencies.requireCurrentOrganizationId ?? tenantModule!.requireCurrentOrganizationId
    ) as Required<BackupDataRouteDependencies>["requireCurrentOrganizationId"],
    modelToJSON: (dependencies.modelToJSON ?? backupModule!.modelToJSON) as Required<
      BackupDataRouteDependencies
    >["modelToJSON"],
    modelBackup: (dependencies.modelBackup ?? backupModule!.MODEL_BACKUP) as Required<
      BackupDataRouteDependencies
    >["modelBackup"],
    listFilesByOrganization: async (organizationId: string) =>
      dbModule!.prisma.file.findMany({
        where: { organizationId },
        select: {
          id: true,
          userId: true,
          organizationId: true,
          path: true,
          mimetype: true,
        },
        orderBy: { createdAt: "asc" },
      }),
    buildBackupStoredEntries,
    updateProgress: dependencies.updateProgress ?? progressModule!.updateProgress,
    ...dependencies,
  }
}

export function createBackupDataRoute(dependencies: BackupDataRouteDependencies = {}) {
  return async function GET(request: Request) {
    const deps = await resolveDependencies(dependencies)
    const user = await deps.getCurrentUser()
    await deps.requireCurrentTenantAdmin({
      getCurrentUser: async () => user,
    })
    const organizationId = await deps.requireCurrentOrganizationId({
      getCurrentUser: async () => user,
    })
    const url = new URL(request.url)
    const progressId = url.searchParams.get("progressId")

    try {
      const zip = new JSZip()
      const rootFolder = zip.folder("data")
      if (!rootFolder) {
        return new NextResponse("Internal Server Error", { status: 500 })
      }

      rootFolder.file(
        "metadata.json",
        JSON.stringify(
          {
            version: BACKUP_VERSION,
            timestamp: new Date().toISOString(),
            models: deps.modelBackup.map((m) => m.filename),
          },
          null,
          2
        )
      )

      for (const backup of deps.modelBackup) {
        try {
          const jsonContent = await deps.modelToJSON(
            {
              userId: user.id,
              organizationId,
            },
            backup
          )
          rootFolder.file(backup.filename, jsonContent)
        } catch (error) {
          console.error(`Error exporting table ${backup.filename}:`, error)
        }
      }

      const uploadsFolder = rootFolder.folder("uploads")
      if (!uploadsFolder) {
        return new NextResponse("Internal Server Error", { status: 500 })
      }

      const uploadedFiles = await deps.listFilesByOrganization(organizationId)

      if (progressId) {
        await deps.updateProgress(user.id, progressId, { total: uploadedFiles.length }, organizationId)
      }

      const storedEntries = await deps.buildBackupStoredEntries(uploadedFiles)
      let processedFiles = 0
      let lastProgressUpdate = Date.now()

      for (const entry of storedEntries) {
        uploadsFolder.file(entry.zipPath.replace(/^data\/uploads\//, ""), entry.body)
        processedFiles++

        const now = Date.now()
        if (progressId && now - lastProgressUpdate >= PROGRESS_UPDATE_INTERVAL_MS) {
          await deps.updateProgress(user.id, progressId, { current: processedFiles }, organizationId)
          lastProgressUpdate = now
        }
      }

      if (progressId) {
        await deps.updateProgress(user.id, progressId, { current: storedEntries.length }, organizationId)
      }

      const archive = await zip.generateAsync({ type: "blob" })

      return new NextResponse(archive, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${config.app.slug}-backup.zip"`,
        },
      })
    } catch (error) {
      console.error("Error exporting database:", error)
      return new NextResponse("Internal Server Error", { status: 500 })
    }
  }
}
