import assert from "node:assert/strict"
import test from "node:test"

import { createS3StorageProvider } from "../../../lib/storage/s3.ts"

function createMockS3Client() {
  const objects = new Map()

  return {
    objects,
    async send(command) {
      const name = command.constructor.name
      const input = command.input

      switch (name) {
        case "PutObjectCommand": {
          const body = Buffer.isBuffer(input.Body) ? input.Body : Buffer.from(input.Body)
          objects.set(input.Key, {
            body,
            contentType: input.ContentType ?? null,
          })
          return {}
        }

        case "GetObjectCommand": {
          const object = objects.get(input.Key)

          if (!object) {
            const error = new Error("NoSuchKey")
            error.name = "NoSuchKey"
            throw error
          }

          return {
            ContentType: object.contentType,
            Body: {
              async transformToByteArray() {
                return Uint8Array.from(object.body)
              },
            },
          }
        }

        case "HeadObjectCommand": {
          if (!objects.has(input.Key)) {
            const error = new Error("NoSuchKey")
            error.name = "NoSuchKey"
            throw error
          }

          return {}
        }

        case "DeleteObjectCommand": {
          objects.delete(input.Key)
          return {}
        }

        case "CopyObjectCommand": {
          const copySource = String(input.CopySource).replace(/^[^/]+\//, "")
          const source = objects.get(copySource)

          if (!source) {
            const error = new Error("NoSuchKey")
            error.name = "NoSuchKey"
            throw error
          }

          objects.set(input.Key, {
            body: Buffer.from(source.body),
            contentType: input.ContentType ?? source.contentType,
          })
          return {}
        }

        case "ListObjectsV2Command": {
          const prefix = input.Prefix ?? ""
          const contents = [...objects.entries()]
            .filter(([key]) => key.startsWith(prefix))
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, value]) => ({
              Key: key,
              Size: value.body.byteLength,
            }))

          return {
            Contents: contents,
            IsTruncated: false,
          }
        }

        default:
          throw new Error(`Unsupported command in test client: ${name}`)
      }
    },
  }
}

test("s3 storage provider guarda, lee, copia, mueve y lista dentro del tenant", async () => {
  const client = createMockS3Client()
  const provider = createS3StorageProvider({
    bucket: "ledgerflow-test",
    region: "eu-west-1",
    client,
  })
  const sourceKey = "organizations/org-1/uploads/unsorted/file-1.pdf"
  const copiedKey = "organizations/org-1/uploads/transactions/file-1/2026/03/file-1.pdf"
  const movedKey = "organizations/org-1/derived/previews/file-1/1.webp"

  const stored = await provider.put({
    ownerOrganizationId: "org-1",
    objectKey: sourceKey,
    kind: "unsorted",
    contentType: "application/pdf",
    body: Buffer.from("pdf-content"),
  })

  assert.equal(stored.objectKey, sourceKey)
  assert.equal(await provider.exists({ ownerOrganizationId: "org-1", objectKey: sourceKey }), true)

  const downloaded = await provider.get({
    ownerOrganizationId: "org-1",
    objectKey: sourceKey,
  })

  assert.ok(downloaded)
  assert.equal(downloaded?.body.toString("utf8"), "pdf-content")

  const copied = await provider.copy({
    ownerOrganizationId: "org-1",
    fromObjectKey: sourceKey,
    toObjectKey: copiedKey,
  })

  assert.ok(copied)
  assert.equal(copied?.objectKey, copiedKey)

  const moved = await provider.move({
    ownerOrganizationId: "org-1",
    fromObjectKey: copiedKey,
    toObjectKey: movedKey,
  })

  assert.ok(moved)
  assert.equal(moved?.objectKey, movedKey)
  assert.equal(await provider.exists({ ownerOrganizationId: "org-1", objectKey: copiedKey }), false)

  const previews = await provider.list({
    ownerOrganizationId: "org-1",
    prefix: "derived/previews",
    objectKey: "",
  })

  assert.deepEqual(
    previews.map((item) => item.objectKey),
    [movedKey]
  )
})

test("s3 storage provider abre descargas en buffer y bloquea claves fuera del tenant", async () => {
  const client = createMockS3Client()
  const provider = createS3StorageProvider({
    bucket: "ledgerflow-test",
    region: "eu-west-1",
    client,
  })
  const objectKey = "organizations/org-1/static/logo.png"

  await provider.put({
    ownerOrganizationId: "org-1",
    objectKey,
    kind: "static",
    contentType: "image/png",
    body: Buffer.from("png"),
  })

  const handle = await provider.openDownload({
    ownerOrganizationId: "org-1",
    objectKey,
    disposition: "inline",
  })

  assert.ok(handle)
  assert.equal(handle?.kind, "buffer")
  assert.equal(handle?.body.toString("utf8"), "png")

  await assert.rejects(
    provider.put({
      ownerOrganizationId: "org-1",
      objectKey: "organizations/org-2/static/logo.png",
      kind: "static",
      contentType: "image/png",
      body: Buffer.from("png"),
    }),
    /organization namespace/
  )
})
