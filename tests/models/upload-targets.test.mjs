import assert from "node:assert/strict"
import test from "node:test"

import {
  buildDefaultTransactionUploadTarget,
  buildDefaultUnsortedUploadTarget,
} from "../../models/upload-targets.ts"

function createUploadFile(name = "factura.pdf", type = "application/pdf") {
  return new File(["pdf-content"], name, {
    type,
    lastModified: 1_710_000_000_000,
  })
}

test("buildDefaultUnsortedUploadTarget genera objectKey canonico de unsorted", () => {
  const target = buildDefaultUnsortedUploadTarget("org-1", "file-1", createUploadFile("Factura.PDF"))

  assert.deepEqual(target, {
    destination: "unsorted",
    storedFilename: "Factura.PDF",
    relativePath: "organizations/org-1/uploads/unsorted/file-1.pdf",
    isReviewed: false,
  })
})

test("buildDefaultTransactionUploadTarget genera objectKey canonico de transaccion", () => {
  const target = buildDefaultTransactionUploadTarget(
    "org-1",
    "file-2",
    createUploadFile("ticket.jpg", "image/jpeg"),
    {
      id: "tx-1",
      issuedAt: new Date("2026-02-10T00:00:00.000Z"),
    }
  )

  assert.deepEqual(target, {
    destination: "transaction",
    storedFilename: "(10-02-26).jpg",
    relativePath: "organizations/org-1/uploads/transactions/file-2/2026/02/(10-02-26).jpg",
    isReviewed: true,
  })
})
