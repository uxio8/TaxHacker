import assert from "node:assert/strict"
import test from "node:test"

import { buildStaticAssetUrl, uploadStaticImage } from "../../lib/uploads.ts"

function createUser(overrides = {}) {
  return {
    id: "user-1",
    email: "user@example.com",
    storageLimit: 100_000,
    storageUsed: 0,
    ...overrides,
  }
}

function createImageFile(name = "avatar.png", type = "image/png") {
  return new File([Buffer.from("image-content")], name, {
    type,
    lastModified: 1_710_000_000_000,
  })
}

test("uploadStaticImage guarda el asset en storage canónico por organización", async () => {
  const writes = []
  const storageChecks = []

  const storedPath = await uploadStaticImage(
    {
      user: createUser(),
      organizationId: "org-1",
      file: createImageFile(),
      assetType: "avatar",
      assetId: "user-1",
      saveFileName: "avatar.webp",
      maxWidth: 500,
      maxHeight: 500,
      quality: 80,
    },
    {
      isEnoughStorageToUploadFile: async (user, fileSize) => {
        storageChecks.push({ user, fileSize })
        return true
      },
      getUserUploadsDirectory: (user) => `/uploads/${user.email}`,
      transformImage: async ({ targetFormat, quality, buffer }) => {
        assert.equal(targetFormat, "webp")
        assert.equal(quality, 80)
        assert.equal(buffer.toString("utf8"), "image-content")
        return Buffer.from("optimized-image")
      },
      putStoredFileBuffer: async (input) => {
        writes.push(input)
        return input.storedPath
      },
    }
  )

  assert.equal(storedPath, "organizations/org-1/static/avatar/user-1.webp")
  assert.equal(buildStaticAssetUrl(storedPath), "/files/static/organizations/org-1/static/avatar/user-1.webp")
  assert.deepEqual(storageChecks, [
    {
      user: {
        id: "user-1",
        email: "user@example.com",
        storageLimit: 100_000,
        storageUsed: 0,
        organizationId: "org-1",
      },
      fileSize: 13,
    },
  ])
  assert.deepEqual(writes, [
    {
      ownerOrganizationId: "org-1",
      ownerUploadsDirectory: "/uploads/user@example.com",
      storedPath: "organizations/org-1/static/avatar/user-1.webp",
      body: Buffer.from("optimized-image"),
      contentType: "image/webp",
      kind: "static",
    },
  ])
})
