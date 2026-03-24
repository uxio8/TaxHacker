import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

async function readSource(relativePath) {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8")
}

test("la revisión fiscal incorpora un compositor de solicitudes para el cliente", async () => {
  const listSource = await readSource("components/tax/review/review-queue-list.tsx")
  const composerSource = await readSource("components/tax/review/review-request-composer.tsx")

  assert.match(listSource, /ReviewRequestComposer/)
  assert.match(composerSource, /useActionState/)
  assert.match(composerSource, /createFiscalReviewRequestAction/)
  assert.match(composerSource, /name="message"/)
  assert.match(composerSource, /name="dueDate"/)
  assert.match(composerSource, /name="owner"/)
})

test("unsorted y capture exponen cuando hay incidencias fiscales abiertas del cliente", async () => {
  const unsortedSource = await readSource("app/(app)/unsorted/page.tsx")
  const captureSource = await readSource("components/capture/mobile-inbox.tsx")

  assert.match(unsortedSource, /incidencias fiscales abiertas/i)
  assert.match(unsortedSource, /resolver documentación pendiente/i)
  assert.match(captureSource, /incidencias fiscales abiertas/i)
  assert.match(captureSource, /documentación pendiente/i)
})
