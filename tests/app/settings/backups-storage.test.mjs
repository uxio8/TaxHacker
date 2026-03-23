import assert from "node:assert/strict"
import test from "node:test"

import JSZip from "jszip"

import { createBackupDataRoute } from "../../../app/(app)/settings/backups/data/create-route.ts"
import {
  buildBackupStoredEntries,
  restoreBackupStoredFilesFromZip,
  toBackupZipPath,
} from "../../../app/(app)/settings/backups/storage.ts"

test("toBackupZipPath conserva claves canónicas y normaliza legacy", () => {
  assert.equal(
    toBackupZipPath("organizations/org-1/uploads/unsorted/file-1.pdf"),
    "data/uploads/organizations/org-1/uploads/unsorted/file-1.pdf"
  )
  assert.equal(
    toBackupZipPath("/tmp/uploads/owner@example.com/unsorted/file-1.pdf"),
    "data/uploads/unsorted/file-1.pdf"
  )
})

test("buildBackupStoredEntries lee adjuntos desde el storage runtime", async () => {
  const entries = await buildBackupStoredEntries(
    [
      {
        id: "file-1",
        userId: "user-owner",
        organizationId: "org-1",
        path: "organizations/org-1/uploads/unsorted/file-1.pdf",
        mimetype: "application/pdf",
      },
    ],
    {
      getUserById: async () => ({ id: "user-owner", email: "owner@example.com" }),
      getUserUploadsDirectory: () => "/tmp/uploads/owner@example.com",
      readStoredFileBuffer: async ({ storedPath }) => Buffer.from(`stored:${storedPath}`),
    }
  )

  assert.deepEqual(entries, [
    {
      file: {
        id: "file-1",
        userId: "user-owner",
        organizationId: "org-1",
        path: "organizations/org-1/uploads/unsorted/file-1.pdf",
        mimetype: "application/pdf",
      },
      zipPath: "data/uploads/organizations/org-1/uploads/unsorted/file-1.pdf",
      body: Buffer.from("stored:organizations/org-1/uploads/unsorted/file-1.pdf"),
    },
  ])
})

test("restoreBackupStoredFilesFromZip reescribe adjuntos en el storage provider", async () => {
  const zip = new JSZip()
  zip.file("data/uploads/organizations/org-1/uploads/unsorted/file-1.pdf", "pdf-content")
  const writes = []

  const restoredCount = await restoreBackupStoredFilesFromZip(
    [
      {
        id: "file-1",
        userId: "user-owner",
        organizationId: "org-1",
        path: "organizations/org-1/uploads/unsorted/file-1.pdf",
        mimetype: "application/pdf",
      },
    ],
    zip,
    {
      id: "admin-user",
      email: "admin@example.com",
    },
    {
      getUserUploadsDirectory: () => "/tmp/uploads/admin@example.com",
      putStoredFileBuffer: async (input) => {
        writes.push(input)
      },
    }
  )

  assert.equal(restoredCount, 1)
  assert.deepEqual(writes, [
    {
      ownerOrganizationId: "org-1",
      ownerUploadsDirectory: "/tmp/uploads/admin@example.com",
      storedPath: "organizations/org-1/uploads/unsorted/file-1.pdf",
      body: Buffer.from("pdf-content"),
      contentType: "application/pdf",
    },
  ])
})

test("GET /settings/backups/data empaqueta adjuntos con claves canónicas", async () => {
  const handler = createBackupDataRoute({
    getCurrentUser: async () => ({ id: "user-1" }),
    requireCurrentTenantAdmin: async () => {},
    requireCurrentOrganizationId: async () => "org-1",
    modelToJSON: async () => "[]",
    listFilesByOrganization: async () => [
      {
        id: "file-1",
        userId: "user-owner",
        organizationId: "org-1",
        path: "organizations/org-1/uploads/unsorted/file-1.pdf",
        mimetype: "application/pdf",
      },
    ],
    buildBackupStoredEntries: async () => [
      {
        file: {
          id: "file-1",
          userId: "user-owner",
          organizationId: "org-1",
          path: "organizations/org-1/uploads/unsorted/file-1.pdf",
          mimetype: "application/pdf",
        },
        zipPath: "data/uploads/organizations/org-1/uploads/unsorted/file-1.pdf",
        body: Buffer.from("pdf-content"),
      },
    ],
    updateProgress: async () => {},
  })

  const response = await handler(new Request("http://localhost/settings/backups/data"))
  const zip = await JSZip.loadAsync(Buffer.from(await response.arrayBuffer()))

  assert.equal(response.status, 200)
  assert.equal(
    await zip.file("data/uploads/organizations/org-1/uploads/unsorted/file-1.pdf").async("string"),
    "pdf-content"
  )
})
