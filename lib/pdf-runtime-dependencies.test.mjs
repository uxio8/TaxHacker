import assert from "node:assert/strict"
import test from "node:test"

import {
  assertPdfRuntimeDependencies,
  getPdfRuntimeDependencyError,
  getMissingPdfRuntimeCommands,
} from "./pdf-runtime-dependencies.ts"

test("getMissingPdfRuntimeCommands returns the commands that are not installed", async () => {
  const missing = await getMissingPdfRuntimeCommands(async (command) => command === "gm")

  assert.deepEqual(missing, ["gs"])
})

test("getPdfRuntimeDependencyError gives an actionable install message", () => {
  assert.equal(
    getPdfRuntimeDependencyError(["gm", "gs"]),
    "PDF previews and AI analysis require GraphicsMagick (`gm`) and Ghostscript (`gs`) on the server. Install them locally with `brew install graphicsmagick ghostscript`, or use the Docker setup that already includes them."
  )
})

test("assertPdfRuntimeDependencies throws when required PDF binaries are missing", async () => {
  await assert.rejects(
    assertPdfRuntimeDependencies(async () => false),
    /GraphicsMagick .* Ghostscript/
  )
})
