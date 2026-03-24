import assert from "node:assert/strict"
import path from "node:path"
import test from "node:test"

import { resolveStoredFileAbsolutePath } from "../../../lib/storage/paths.ts"

test("resolveStoredFileAbsolutePath mantiene compatibilidad con rutas legacy por usuario", () => {
  assert.equal(
    resolveStoredFileAbsolutePath({
      storageBasePath: "/app/uploads",
      ownerUploadsDirectory: "/app/uploads/owner@example.com",
      storedPath: "unsorted/file-1.pdf",
    }),
    path.posix.normalize("/app/uploads/owner@example.com/unsorted/file-1.pdf")
  )
})

test("resolveStoredFileAbsolutePath resuelve objectKey canonico desde la raiz de storage", () => {
  assert.equal(
    resolveStoredFileAbsolutePath({
      storageBasePath: "/app/uploads",
      ownerUploadsDirectory: "/app/uploads/owner@example.com",
      storedPath: "organizations/org-1/uploads/unsorted/file-1.pdf",
    }),
    path.posix.normalize("/app/uploads/organizations/org-1/uploads/unsorted/file-1.pdf")
  )
})
