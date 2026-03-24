"use server"

import sharp from "sharp"
import { fileExists, getUserUploadsDirectory } from "../files.ts"
import config from "../config.ts"
import { putStoredFileBuffer, storedPathExists } from "../storage/runtime.ts"
import {
  buildCanonicalPreviewStorageLocation,
  buildLegacyImagePreviewAbsolutePath,
  type PreviewStorageOwner,
} from "./storage.ts"

export async function resizeImage(
  owner: PreviewStorageOwner,
  organizationId: string,
  fileId: string,
  origFilePath: string,
  maxWidth: number = config.upload.images.maxWidth,
  maxHeight: number = config.upload.images.maxHeight,
  quality: number = config.upload.images.quality
): Promise<{ contentType: string; resizedPath: string }> {
  try {
    const canonicalPreview = buildCanonicalPreviewStorageLocation(
      {
        owner,
        organizationId,
        fileId,
      },
      1
    )
    const legacyPreviewPath = buildLegacyImagePreviewAbsolutePath(owner, origFilePath)
    const ownerUploadsDirectory = getUserUploadsDirectory(owner as never)

    if (await storedPathExists({
      ownerOrganizationId: organizationId,
      ownerUploadsDirectory,
      storedPath: canonicalPreview.objectKey,
    })) {
      return {
        contentType: "image/webp",
        resizedPath: canonicalPreview.objectKey,
      }
    }

    if (await fileExists(legacyPreviewPath)) {
      const metadata = await sharp(legacyPreviewPath).metadata()
      return {
        contentType: `image/${metadata.format}`,
        resizedPath: legacyPreviewPath,
      }
    }

    const previewBuffer = await sharp(origFilePath)
      .rotate()
      .resize(maxWidth, maxHeight, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: quality })
      .toBuffer()

    await putStoredFileBuffer({
      ownerOrganizationId: organizationId,
      ownerUploadsDirectory,
      storedPath: canonicalPreview.objectKey,
      body: previewBuffer,
      contentType: "image/webp",
      kind: "preview",
    })

    return {
      contentType: "image/webp",
      resizedPath: canonicalPreview.objectKey,
    }
  } catch (error) {
    console.error("Error resizing image:", error)
    return {
      contentType: "image/unknown",
      resizedPath: origFilePath,
    }
  }
}
