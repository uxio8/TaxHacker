import assert from "node:assert/strict"
import path from "node:path"
import test from "node:test"

import {
  buildCanonicalPreviewStorageLocation,
  buildLegacyImagePreviewAbsolutePath,
  buildLegacyPdfPreviewAbsolutePath,
  getCanonicalPreviewDirectory,
} from "../../../lib/previews/storage.ts"

const owner = {
  id: "user-1",
  email: "owner@example.com",
}

test("storage de previews construye claves y rutas canónicas por organización", () => {
  const preview = buildCanonicalPreviewStorageLocation(
    {
      owner,
      organizationId: "org-1",
      fileId: "file-1",
    },
    2
  )

  assert.deepEqual(preview, {
    objectKey: "organizations/org-1/derived/previews/file-1/2.webp",
    absolutePath: path.resolve("./uploads/organizations/org-1/derived/previews/file-1/2.webp"),
  })

  assert.equal(
    getCanonicalPreviewDirectory({
      owner,
      organizationId: "org-1",
      fileId: "file-1",
    }),
    path.resolve("./uploads/organizations/org-1/derived/previews/file-1")
  )
})

test("storage de previews mantiene resolución legacy para imagen y pdf", () => {
  assert.equal(
    buildLegacyImagePreviewAbsolutePath(owner, "/tmp/factura-original.pdf"),
    path.resolve("./uploads/owner@example.com/previews/factura-original.webp")
  )
  assert.equal(
    buildLegacyPdfPreviewAbsolutePath(owner, "/tmp/factura-original.pdf", 3),
    path.resolve("./uploads/owner@example.com/previews/factura-original.3.webp")
  )
})
