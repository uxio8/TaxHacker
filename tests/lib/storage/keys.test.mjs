import assert from "node:assert/strict"
import test from "node:test"

import {
  buildOrganizationPreviewObjectKey,
  buildOrganizationStaticObjectKey,
  buildOrganizationStoragePrefix,
  buildOrganizationTransactionObjectKey,
  buildOrganizationUnsortedObjectKey,
  isCanonicalOrganizationObjectKey,
} from "../../../lib/storage/keys.ts"

test("storage keys construye las rutas canonicas del tenant", () => {
  assert.equal(buildOrganizationStoragePrefix("org-1"), "organizations/org-1")
  assert.equal(
    buildOrganizationUnsortedObjectKey("org-1", "file-1", "Factura.PDF"),
    "organizations/org-1/uploads/unsorted/file-1.pdf"
  )
  assert.equal(
    buildOrganizationTransactionObjectKey(
      "org-1",
      "file-1",
      "FV: 23/0004  ACME S.L..pdf",
      new Date("2026-03-22T10:00:00.000Z")
    ),
    "organizations/org-1/uploads/transactions/file-1/2026/03/FV- 23-0004 ACME S.L..pdf"
  )
  assert.equal(
    buildOrganizationPreviewObjectKey("org-1", "file-1", 2),
    "organizations/org-1/derived/previews/file-1/2.webp"
  )
  assert.equal(
    buildOrganizationStaticObjectKey("org-1", "business logo", "logo:main", "logo.PNG"),
    "organizations/org-1/static/business logo/logo-main.png"
  )
})

test("isCanonicalOrganizationObjectKey solo acepta claves canonicas del namespace organizations", () => {
  assert.equal(
    isCanonicalOrganizationObjectKey("organizations/org-1/uploads/unsorted/file-1.pdf"),
    true
  )
  assert.equal(isCanonicalOrganizationObjectKey("organizations/../org-1/uploads/unsorted/file-1.pdf"), false)
  assert.equal(isCanonicalOrganizationObjectKey("/organizations/org-1/uploads/unsorted/file-1.pdf"), false)
  assert.equal(isCanonicalOrganizationObjectKey("uploads/org-1/file-1.pdf"), false)
  assert.equal(isCanonicalOrganizationObjectKey("organizations/"), false)
})
