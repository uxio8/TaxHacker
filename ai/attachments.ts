import { getUserUploadsDirectory } from "@/lib/files"
import { generateFilePreviews } from "@/lib/previews/generate"
import { isCanonicalOrganizationObjectKey } from "@/lib/storage/keys"
import { materializeStoredFileToLocalPath, readStoredFileBuffer } from "@/lib/storage/runtime"
import { File, User } from "@/prisma/client"
import fs from "fs/promises"

const MAX_PAGES_TO_ANALYZE = 4

export type AnalyzeAttachment = {
  filename: string
  contentType: string
  base64: string
  filePath: string
}

export const loadAttachmentsForAI = async (user: User, file: File): Promise<AnalyzeAttachment[]> => {
  const ownerUploadsDirectory = getUserUploadsDirectory(user)
  const materializedFile = await materializeStoredFileToLocalPath({
    ownerOrganizationId: file.organizationId,
    ownerUploadsDirectory,
    storedPath: file.path,
  })

  try {
    const { contentType, previews } = await generateFilePreviews(
      user,
      file.organizationId,
      file.id,
      materializedFile.path,
      file.mimetype
    )

    return Promise.all(
      previews.slice(0, MAX_PAGES_TO_ANALYZE).map(async (preview) => {
        const previewBuffer = isCanonicalOrganizationObjectKey(preview)
          ? await readStoredFileBuffer({
            ownerOrganizationId: file.organizationId,
            ownerUploadsDirectory,
            storedPath: preview,
          })
          : await fs.readFile(preview)

        return {
          filename: file.filename,
          contentType: contentType,
          base64: Buffer.from(previewBuffer).toString("base64"),
          filePath: preview,
        }
      })
    )
  } finally {
    await materializedFile.cleanup()
  }
}

export const loadFileAsBase64 = async (filePath: string): Promise<string> => {
  const buffer = await fs.readFile(filePath)
  return Buffer.from(buffer).toString("base64")
}
