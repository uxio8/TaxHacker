"use server"

import fs from "fs/promises"
import os from "node:os"
import path from "node:path"
import { fromPath } from "pdf2pic"
import { fileExists, getUserUploadsDirectory } from "../files.ts"
import config from "../config.ts"
import { assertPdfRuntimeDependencies } from "../pdf-runtime-dependencies.ts"
import { putStoredFileBuffer, storedPathExists } from "../storage/runtime.ts"
import {
  buildCanonicalPreviewStorageLocation,
  buildLegacyPdfPreviewAbsolutePath,
  type PreviewStorageOwner,
} from "./storage.ts"

type Pdf2PicImageResult = {
  path?: string | null
}

type PdfToImagesDependencies = {
  fileExists?: (filePath: string) => Promise<boolean>
  storedPathExists?: (input: {
    ownerOrganizationId: string
    ownerUploadsDirectory: string
    storedPath: string
  }) => Promise<boolean>
  assertPdfRuntimeDependencies?: () => Promise<void>
  createTempDirectory?: () => Promise<string>
  createConvert?: typeof fromPath
  readFile?: (filePath: string) => Promise<Buffer>
  putStoredFileBuffer?: (input: {
    ownerOrganizationId: string
    ownerUploadsDirectory: string
    storedPath: string
    body: Buffer
    contentType: string | null
    kind?: "preview"
  }) => Promise<unknown>
  deleteFile?: (filePath: string) => Promise<void>
  removeDirectory?: (directoryPath: string) => Promise<void>
}

export async function pdfToImages(
  owner: PreviewStorageOwner,
  organizationId: string,
  fileId: string,
  origFilePath: string,
  dependencies: PdfToImagesDependencies = {}
): Promise<{ contentType: string; pages: string[] }> {
  const deps = {
    fileExists,
    storedPathExists,
    assertPdfRuntimeDependencies,
    createTempDirectory: () => fs.mkdtemp(path.join(os.tmpdir(), "ledgerflow-preview-")),
    createConvert: fromPath,
    readFile: fs.readFile,
    putStoredFileBuffer,
    deleteFile: fs.unlink,
    removeDirectory: (directoryPath: string) => fs.rm(directoryPath, { recursive: true, force: true }),
    ...dependencies,
  }
  const maxPages = config.upload.pdfs.maxPages
  const ownerUploadsDirectory = getUserUploadsDirectory(owner as never)

  const existingPages: string[] = []
  for (let i = 1; i <= maxPages; i++) {
    const convertedFilePath = buildCanonicalPreviewStorageLocation(
      {
        owner,
        organizationId,
        fileId,
      },
      i
    ).objectKey
    if (await deps.storedPathExists({
      ownerOrganizationId: organizationId,
      ownerUploadsDirectory,
      storedPath: convertedFilePath,
    })) {
      existingPages.push(convertedFilePath)
    } else {
      break
    }
  }

  if (existingPages.length > 0) {
    return { contentType: "image/webp", pages: existingPages }
  }

  const existingLegacyPages: string[] = []
  for (let i = 1; i <= maxPages; i++) {
    const convertedFilePath = buildLegacyPdfPreviewAbsolutePath(owner, origFilePath, i)
    if (await deps.fileExists(convertedFilePath)) {
      existingLegacyPages.push(convertedFilePath)
    } else {
      break
    }
  }

  if (existingLegacyPages.length > 0) {
    return { contentType: "image/webp", pages: existingLegacyPages }
  }

  const pdf2picOptions = {
    density: config.upload.pdfs.dpi,
    saveFilename: "preview",
    savePath: await deps.createTempDirectory(),
    format: "webp",
    quality: config.upload.pdfs.quality,
    width: config.upload.pdfs.maxWidth,
    height: config.upload.pdfs.maxHeight,
    preserveAspectRatio: true,
  }

  try {
    await deps.assertPdfRuntimeDependencies()
    const convert = deps.createConvert(origFilePath, pdf2picOptions)
    const requestedPages = Array.from({ length: maxPages }, (_, index) => index + 1)
    let results: Pdf2PicImageResult[]

    try {
      results = await convert.bulk(requestedPages, { responseType: "image" })
    } catch {
      const allResults = await convert.bulk(-1, { responseType: "image" })
      const extraResults = allResults.slice(maxPages)

      await Promise.all(
        extraResults
          .map((result) => result.path)
          .filter((resultPath): resultPath is string => typeof resultPath === "string")
          .map(async (resultPath) => {
            try {
              await deps.deleteFile(resultPath)
            } catch {
              // best effort cleanup
            }
          })
      )

      results = allResults.slice(0, maxPages)
    }

    const paths = await Promise.all(
      results
        .map((result) => result.path)
        .filter((resultPath): resultPath is string => typeof resultPath === "string")
        .map(async (resultPath, index) => {
          const targetPath = buildCanonicalPreviewStorageLocation(
            {
              owner,
              organizationId,
              fileId,
            },
            index + 1
          ).objectKey
          const buffer = await deps.readFile(resultPath)
          await deps.putStoredFileBuffer({
            ownerOrganizationId: organizationId,
            ownerUploadsDirectory,
            storedPath: targetPath,
            body: buffer,
            contentType: "image/webp",
            kind: "preview",
          })
          return targetPath
        })
    )

    return {
      contentType: "image/webp",
      pages: paths,
    }
  } catch (error) {
    console.error("Error converting PDF to image:", error)
    throw error
  } finally {
    await deps.removeDirectory(pdf2picOptions.savePath)
  }
}
