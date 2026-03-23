import type { User } from "@/prisma/client"
import path from "path"
import sharp from "sharp"
import config from "./config.ts"
import { getUserUploadsDirectory, isEnoughStorageToUploadFile } from "./files.ts"
import { buildOrganizationStaticObjectKey } from "./storage/keys.ts"
import { putStoredFileBuffer } from "./storage/runtime.ts"

type UploadStaticImageInput = {
  user: User
  organizationId: string
  file: File
  assetType: string
  assetId: string
  saveFileName: string
  maxWidth?: number
  maxHeight?: number
  quality?: number
}

type UploadStaticImageDependencies = {
  isEnoughStorageToUploadFile?: typeof isEnoughStorageToUploadFile
  getUserUploadsDirectory?: typeof getUserUploadsDirectory
  transformImage?: (input: {
    buffer: Buffer
    targetFormat: string
    maxWidth: number
    maxHeight: number
    quality: number
  }) => Promise<Buffer>
  putStoredFileBuffer?: typeof putStoredFileBuffer
}

function getStaticImageContentType(targetFormat: string) {
  switch (targetFormat) {
    case "png":
      return "image/png"
    case "jpg":
    case "jpeg":
      return "image/jpeg"
    case "webp":
      return "image/webp"
    case "avif":
      return "image/avif"
    default:
      throw Error(`Unsupported target format: ${targetFormat}`)
  }
}

async function transformStaticImage(input: {
  buffer: Buffer
  targetFormat: string
  maxWidth: number
  maxHeight: number
  quality: number
}) {
  const sharpInstance = sharp(input.buffer).rotate().resize(input.maxWidth, input.maxHeight, {
    fit: "inside",
    withoutEnlargement: true,
  })

  switch (input.targetFormat) {
    case "png":
      return sharpInstance.png().toBuffer()
    case "jpg":
    case "jpeg":
      return sharpInstance.jpeg({ quality: input.quality }).toBuffer()
    case "webp":
      return sharpInstance.webp({ quality: input.quality }).toBuffer()
    case "avif":
      return sharpInstance.avif({ quality: input.quality }).toBuffer()
    default:
      throw Error(`Unsupported target format: ${input.targetFormat}`)
  }
}

export function buildStaticAssetUrl(storedPath: string) {
  return `/files/static/${storedPath}`
}

export async function uploadStaticImage(
  input: UploadStaticImageInput,
  dependencies: UploadStaticImageDependencies = {}
) {
  const deps = {
    isEnoughStorageToUploadFile,
    getUserUploadsDirectory,
    transformImage: transformStaticImage,
    putStoredFileBuffer,
    ...dependencies,
  }

  const maxWidth = input.maxWidth ?? config.upload.images.maxWidth
  const maxHeight = input.maxHeight ?? config.upload.images.maxHeight
  const quality = input.quality ?? config.upload.images.quality

  if (!(await deps.isEnoughStorageToUploadFile({ ...input.user, organizationId: input.organizationId }, input.file.size))) {
    throw Error("Not enough space to upload the file")
  }

  const targetFormat = path.extname(input.saveFileName).slice(1).toLowerCase()
  if (!targetFormat) {
    throw Error("Target filename must have an extension")
  }

  const arrayBuffer = await input.file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const transformedBuffer = await deps.transformImage({
    buffer,
    targetFormat,
    maxWidth,
    maxHeight,
    quality,
  })
  const storedPath = buildOrganizationStaticObjectKey(
    input.organizationId,
    input.assetType,
    input.assetId,
    input.saveFileName
  )

  await deps.putStoredFileBuffer({
    ownerOrganizationId: input.organizationId,
    ownerUploadsDirectory: deps.getUserUploadsDirectory(input.user),
    storedPath,
    body: transformedBuffer,
    contentType: getStaticImageContentType(targetFormat),
    kind: "static",
  })

  return storedPath
}
