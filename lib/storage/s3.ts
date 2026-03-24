import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  type S3Client,
  S3Client as AwsS3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3"

import type {
  StorageCopyInput,
  StorageBufferDownloadHandle,
  StorageDownloadHandle,
  StorageGetResult,
  StorageListInput,
  StorageObject,
  StorageObjectKind,
  StorageObjectRef,
  StorageProvider,
  StoragePutInput,
} from "./types.ts"
import { assertObjectKeyBelongsToOrganization, inferStorageObjectKind } from "./types.ts"

export type S3StorageProviderOptions = {
  bucket: string
  region: string
  endpoint?: string | null
  forcePathStyle?: boolean
  accessKeyId?: string | null
  secretAccessKey?: string | null
  sessionToken?: string | null
  client?: Pick<S3Client, "send">
}

function normalizeObjectKey(ownerOrganizationId: string, objectKey: string) {
  const normalizedObjectKey = objectKey.replace(/^\/+/, "")
  assertObjectKeyBelongsToOrganization(ownerOrganizationId, normalizedObjectKey)
  return normalizedObjectKey
}

function inferContentTypeFromObjectKey(objectKey: string) {
  const normalized = objectKey.toLowerCase()

  if (normalized.endsWith(".pdf")) {
    return "application/pdf"
  }

  if (normalized.endsWith(".webp")) {
    return "image/webp"
  }

  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) {
    return "image/jpeg"
  }

  if (normalized.endsWith(".png")) {
    return "image/png"
  }

  return null
}

function buildStoredObject(
  ownerOrganizationId: string,
  objectKey: string,
  size: number,
  kind?: StorageObjectKind,
  contentType: string | null = inferContentTypeFromObjectKey(objectKey)
): StorageObject {
  return {
    ownerOrganizationId,
    objectKey,
    kind: kind ?? inferStorageObjectKind(objectKey),
    contentType,
    size,
  }
}

async function bodyToBuffer(body: Uint8Array) {
  return Buffer.from(body)
}

function createClient(options: S3StorageProviderOptions) {
  if (options.client) {
    return options.client
  }

  return new AwsS3Client({
    region: options.region,
    endpoint: options.endpoint || undefined,
    forcePathStyle: options.forcePathStyle ?? Boolean(options.endpoint),
    credentials:
      options.accessKeyId && options.secretAccessKey
        ? {
            accessKeyId: options.accessKeyId,
            secretAccessKey: options.secretAccessKey,
            sessionToken: options.sessionToken || undefined,
          }
        : undefined,
  })
}

export function createS3StorageProvider(options: S3StorageProviderOptions): StorageProvider {
  const bucket = options.bucket.trim()

  if (!bucket) {
    throw new Error("STORAGE_S3_BUCKET es obligatorio cuando STORAGE_PROVIDER=s3")
  }

  const client = createClient(options)

  async function get(input: StorageObjectRef): Promise<StorageGetResult | null> {
    const objectKey = normalizeObjectKey(input.ownerOrganizationId, input.objectKey)

    try {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: objectKey,
        })
      )

      if (!response.Body) {
        return null
      }

      const body = await bodyToBuffer(await response.Body.transformToByteArray())
      return {
        ...buildStoredObject(
          input.ownerOrganizationId,
          objectKey,
          body.byteLength,
          undefined,
          response.ContentType ?? inferContentTypeFromObjectKey(objectKey)
        ),
        body,
      }
    } catch (error) {
      if (isMissingS3ObjectError(error)) {
        return null
      }

      throw error
    }
  }

  async function putObject(input: StoragePutInput) {
      const objectKey = normalizeObjectKey(input.ownerOrganizationId, input.objectKey)
      const body = Buffer.isBuffer(input.body)
        ? input.body
        : typeof input.body === "string"
          ? Buffer.from(input.body)
          : Buffer.from(input.body)

      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          Body: body,
          ContentType: input.contentType || undefined,
        })
      )

      return buildStoredObject(
        input.ownerOrganizationId,
        objectKey,
        body.byteLength,
        input.kind,
        input.contentType
      )
  }

  async function existsObject(input: StorageObjectRef) {
      const objectKey = normalizeObjectKey(input.ownerOrganizationId, input.objectKey)

      try {
        await client.send(
          new HeadObjectCommand({
            Bucket: bucket,
            Key: objectKey,
          })
        )
        return true
      } catch (error) {
        if (isMissingS3ObjectError(error)) {
          return false
        }

        throw error
      }
  }

  async function deleteObject(input: StorageObjectRef) {
      const objectKey = normalizeObjectKey(input.ownerOrganizationId, input.objectKey)

      try {
        await client.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: objectKey,
          })
        )
        return true
      } catch (error) {
        if (isMissingS3ObjectError(error)) {
          return false
        }

        throw error
      }
  }

  async function copyObject(input: StorageCopyInput) {
      const fromObjectKey = normalizeObjectKey(input.ownerOrganizationId, input.fromObjectKey)
      const toObjectKey = normalizeObjectKey(input.ownerOrganizationId, input.toObjectKey)

      try {
        const existing = await get({
          ownerOrganizationId: input.ownerOrganizationId,
          objectKey: fromObjectKey,
        })

        if (!existing) {
          return null
        }

        await client.send(
          new CopyObjectCommand({
            Bucket: bucket,
            Key: toObjectKey,
            CopySource: `${bucket}/${fromObjectKey}`,
            ContentType: existing.contentType || undefined,
            MetadataDirective: "REPLACE",
          })
        )

        return buildStoredObject(
          input.ownerOrganizationId,
          toObjectKey,
          existing.size,
          undefined,
          existing.contentType
        )
      } catch (error) {
        if (isMissingS3ObjectError(error)) {
          return null
        }

        throw error
      }
  }

  async function moveObject(input: StorageCopyInput) {
      const copied = await copyObject(input)

      if (!copied) {
        return null
      }

      await deleteObject({
        ownerOrganizationId: input.ownerOrganizationId,
        objectKey: input.fromObjectKey,
      })

      return copied
  }

  async function listObjects(input: StorageListInput) {
      const prefix = input.prefix.replace(/^\/+|\/+$/g, "")
      const normalizedPrefix = prefix
        ? `organizations/${input.ownerOrganizationId}/${prefix}`
        : `organizations/${input.ownerOrganizationId}`
      const items: StorageObject[] = []
      let continuationToken: string | undefined

      do {
        const response = await client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: normalizedPrefix,
            ContinuationToken: continuationToken,
          })
        )

        for (const object of response.Contents ?? []) {
          if (!object.Key) {
            continue
          }

          items.push(
            buildStoredObject(
              input.ownerOrganizationId,
              object.Key,
              Number(object.Size ?? 0),
              undefined,
              inferContentTypeFromObjectKey(object.Key)
            )
          )
        }

        continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined
      } while (continuationToken)

      return items.sort((left, right) => left.objectKey.localeCompare(right.objectKey))
  }

  async function openDownloadHandle(
      input: StorageObjectRef & {
        disposition: "inline" | "attachment"
      }
    ): Promise<StorageDownloadHandle | null> {
      const object = await get(input)

      if (!object) {
        return null
      }

      const handle: StorageBufferDownloadHandle = {
        ...object,
        kind: "buffer",
        disposition: input.disposition,
      }

      return handle
  }

  return {
    kind: "s3",
    put: putObject,
    get,
    exists: existsObject,
    delete: deleteObject,
    copy: copyObject,
    move: moveObject,
    list: listObjects,
    openDownload: openDownloadHandle,
  }
}

function isMissingS3ObjectError(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return false
  }

  const candidate = error as {
    name?: string
    Code?: string
    $metadata?: {
      httpStatusCode?: number
    }
  }

  return (
    candidate.name === "NoSuchKey"
    || candidate.Code === "NoSuchKey"
    || candidate.$metadata?.httpStatusCode === 404
  )
}
