import assert from "node:assert/strict"
import test from "node:test"

import { toStoredAnalysisJobAttachments } from "./analysis-jobs.ts"

test("toStoredAnalysisJobAttachments persiste el base64 y limpia filePath efimero", () => {
  const attachments = toStoredAnalysisJobAttachments([
    {
      filename: "receipt.webp",
      contentType: "image/webp",
      filePath: "/tmp/receipt.webp",
      base64: "very-large-payload",
    },
  ])

  assert.deepEqual(attachments, [
    {
      filename: "receipt.webp",
      contentType: "image/webp",
      filePath: "",
      base64: "very-large-payload",
    },
  ])
})
