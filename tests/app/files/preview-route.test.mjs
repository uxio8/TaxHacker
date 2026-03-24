import assert from "node:assert/strict"
import test from "node:test"

import { createFilePreviewRoute } from "../../../app/(app)/files/preview/[fileId]/create-route.ts"

test("GET /files/preview/[fileId] sirve la preview solicitada", async () => {
  const handler = createFilePreviewRoute({
    getCurrentUser: async () => ({ id: "user-1" }),
    requireCurrentOrganizationId: async () => "org-1",
    getFileById: async () => ({
      id: "file-1",
      organizationId: "org-1",
      userId: "user-owner",
      path: "organizations/org-1/uploads/unsorted/file-1.pdf",
      mimetype: "application/pdf",
    }),
    getUserById: async () => ({
      id: "user-owner",
      email: "owner@example.com",
    }),
    getUserUploadsDirectory: () => "/tmp/uploads/user-owner",
    materializeStoredFileToLocalPath: async () => ({
      path: "/tmp/file-1.pdf",
      cleanup: async () => {},
    }),
    generateFilePreviews: async () => ({
      contentType: "image/webp",
      previews: [
        "organizations/org-1/derived/previews/file-1/1.webp",
        "organizations/org-1/derived/previews/file-1/2.webp",
      ],
    }),
    readStoredFileBuffer: async ({ storedPath }) => Buffer.from(`stored:${storedPath}`),
    readFile: async (filePath) => Buffer.from(`read:${filePath}`),
  })

  const response = await handler(new Request("http://localhost/files/preview/file-1?page=2"), {
    params: Promise.resolve({ fileId: "file-1" }),
  })

  assert.equal(response.status, 200)
  assert.equal(response.headers.get("Content-Type"), "image/webp")
  assert.match(response.headers.get("Content-Disposition") || "", /2\.webp/)
  assert.equal(await response.text(), "stored:organizations/org-1/derived/previews/file-1/2.webp")
})

test("GET /files/preview/[fileId] devuelve 404 si la página no existe", async () => {
  const handler = createFilePreviewRoute({
    getCurrentUser: async () => ({ id: "user-1" }),
    requireCurrentOrganizationId: async () => "org-1",
    getFileById: async () => ({
      id: "file-1",
      organizationId: "org-1",
      userId: "user-owner",
      path: "organizations/org-1/uploads/unsorted/file-1.pdf",
      mimetype: "application/pdf",
    }),
    getUserById: async () => ({
      id: "user-owner",
      email: "owner@example.com",
    }),
    getUserUploadsDirectory: () => "/tmp/uploads/user-owner",
    materializeStoredFileToLocalPath: async () => ({
      path: "/tmp/file-1.pdf",
      cleanup: async () => {},
    }),
    generateFilePreviews: async () => ({
      contentType: "image/webp",
      previews: ["/tmp/preview-1.webp"],
    }),
    readFile: async () => Buffer.from("unused"),
  })

  const response = await handler(new Request("http://localhost/files/preview/file-1?page=2"), {
    params: Promise.resolve({ fileId: "file-1" }),
  })

  assert.equal(response.status, 404)
  assert.equal(await response.text(), "Page not found")
})
