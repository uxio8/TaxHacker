import assert from "node:assert/strict"
import test from "node:test"

import { canAnalyzeFileMimeType } from "./analysis-support.ts"

test("canAnalyzeFileMimeType allows images and pdf documents", () => {
  assert.equal(canAnalyzeFileMimeType("image/png"), true)
  assert.equal(canAnalyzeFileMimeType("image/jpeg"), true)
  assert.equal(canAnalyzeFileMimeType("application/pdf"), true)
})

test("canAnalyzeFileMimeType rejects office documents that are not converted for AI yet", () => {
  assert.equal(canAnalyzeFileMimeType("application/msword"), false)
  assert.equal(
    canAnalyzeFileMimeType("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    false
  )
  assert.equal(canAnalyzeFileMimeType("application/vnd.ms-excel"), false)
  assert.equal(
    canAnalyzeFileMimeType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    false
  )
})
