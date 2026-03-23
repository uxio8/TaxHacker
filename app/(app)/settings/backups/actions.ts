"use server"

import { ActionState } from "@/lib/actions"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { normalizeBackupFilePath } from "@/lib/file-security"
import { createTranslator } from "@/lib/i18n"
import { requireCurrentOrganizationId, requireCurrentTenantAdmin } from "@/lib/tenant"
import { MODEL_BACKUP, modelFromJSON } from "@/models/backups"
import { syncOrganizationStorageUsageSnapshot } from "@/models/billing/usage"
import JSZip from "jszip"

import {
  clearTenantStoredFiles,
  restoreBackupStoredFilesFromZip,
  toBackupZipPath,
} from "./storage"

const SUPPORTED_BACKUP_VERSIONS = ["1.0"]
const REMOVE_EXISTING_DATA = true
const MAX_BACKUP_SIZE = 256 * 1024 * 1024 // 256MB

const t = createTranslator()

type BackupRestoreResult = {
  counters: Record<string, number>
}

export async function restoreBackupAction(
  _prevState: ActionState<BackupRestoreResult> | null,
  formData: FormData
): Promise<ActionState<BackupRestoreResult>> {
  const user = await getCurrentUser()
  await requireCurrentTenantAdmin({
    getCurrentUser: async () => user,
  })
  const organizationId = await requireCurrentOrganizationId({
    getCurrentUser: async () => user,
  })
  const file = formData.get("file") as File

  if (!file || file.size === 0) {
    return { success: false, error: t("settings.errors.backupNoFile") }
  }

  if (file.size > MAX_BACKUP_SIZE) {
    return {
      success: false,
      error: t("settings.errors.backupTooLarge", { size: MAX_BACKUP_SIZE / 1024 / 1024 }),
    }
  }

  // Read zip archive
  let zip: JSZip
  try {
    const fileBuffer = await file.arrayBuffer()
    const fileData = Buffer.from(fileBuffer)
    zip = await JSZip.loadAsync(fileData)
  } catch (error) {
    return {
      success: false,
      error: t("settings.errors.backupBadArchive", { message: (error as Error).message }),
    }
  }

  // Check metadata and start restoring
  try {
    const metadataFile = zip.file("data/metadata.json")
    if (metadataFile) {
      const metadataContent = await metadataFile.async("string")
      try {
        const metadata = JSON.parse(metadataContent)
        if (!metadata.version || !SUPPORTED_BACKUP_VERSIONS.includes(metadata.version)) {
          return {
            success: false,
            error: t("settings.errors.backupIncompatibleVersion", {
              version: metadata.version || "unknown",
              supportedVersions: SUPPORTED_BACKUP_VERSIONS.join(", "),
            }),
          }
        }
        console.log(`Restoring backup version ${metadata.version} created at ${metadata.timestamp}`)
      } catch (error) {
        console.warn("Could not parse backup metadata:", error)
      }
    } else {
      console.warn("No metadata found in backup, assuming legacy format")
    }

    await validateBackupFilesArchive(zip)

    // Remove existing data
    if (REMOVE_EXISTING_DATA) {
      await cleanupOrganizationTables(organizationId)
      await clearTenantStoredFiles({
        organizationId,
        currentUser: {
          id: user.id,
          email: user.email,
        },
      })
    }

    const counters: Record<string, number> = {}

    // Restore tables
    for (const backup of MODEL_BACKUP) {
      try {
        const jsonFile = zip.file(`data/${backup.filename}`)
        if (jsonFile) {
          const jsonContent = await jsonFile.async("string")
          const restoredCount = await modelFromJSON(
            {
              userId: user.id,
              organizationId,
            },
            backup,
            jsonContent
          )
          console.log(`Restored ${restoredCount} records from ${backup.filename}`)
          counters[backup.filename] = restoredCount
        }
      } catch (error) {
        console.error(`Error restoring model from ${backup.filename}:`, error)
      }
    }

    // Restore files
    try {
      const files = await prisma.file.findMany({
        where: {
          organizationId,
        },
      })

      const restoredFilesCount = await restoreBackupStoredFilesFromZip(files, zip, {
        id: user.id,
        email: user.email,
      })
      counters.uploadedAttachments = restoredFilesCount
    } catch (error) {
      console.error("Error restoring uploaded files:", error)
      return {
        success: false,
        error: t("settings.errors.backupRestoreUploadedFiles", {
          message: error instanceof Error ? error.message : String(error),
        }),
      }
    }

    await syncOrganizationStorageUsageSnapshot({
      organizationId,
      userId: user.id,
      userEmailOrId: user.email || user.id,
    })

    return { success: true, data: { counters } }
  } catch (error) {
    console.error("Error restoring from backup:", error)
    return {
      success: false,
      error: t("settings.errors.backupRestore", {
        message: error instanceof Error ? error.message : String(error),
      }),
    }
  }
}

async function validateBackupFilesArchive(zip: JSZip) {
  const filesManifest = zip.file("data/files.json")
  if (!filesManifest) {
    return
  }

  let records: unknown
  try {
    records = JSON.parse(await filesManifest.async("string"))
  } catch {
    throw new Error(t("settings.errors.backupInvalidFilesManifest"))
  }

  if (!Array.isArray(records)) {
    throw new Error(t("settings.errors.backupInvalidFilesManifest"))
  }

  for (const record of records) {
    if (!record || typeof record !== "object") {
      throw new Error(t("settings.errors.backupInvalidFilesRecord"))
    }

    const maybePath = "path" in record ? record.path : ""
    const normalizedPath = normalizeBackupFilePath(typeof maybePath === "string" ? maybePath : "")
    const zipFilePath = toBackupZipPath(normalizedPath)

    if (!zip.file(zipFilePath)) {
      throw new Error(t("settings.errors.backupMissingUploadedFile", { path: normalizedPath }))
    }
  }
}

async function cleanupOrganizationTables(organizationId: string) {
  // Delete in reverse order to handle foreign key constraints
  for (const { model } of [...MODEL_BACKUP].reverse()) {
    try {
      await model.deleteMany({ where: { organizationId } })
    } catch (error) {
      console.error(`Error clearing table:`, error)
    }
  }
}
