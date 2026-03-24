import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

async function readSource(relativePath) {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8")
}

function extractSpanishCatalog(source) {
  const start = source.indexOf("const ES_ES_MESSAGES")
  const end = source.indexOf("export const MESSAGE_CATALOGS")

  if (start === -1 || end === -1) {
    throw new Error("No se pudo localizar el catálogo es-ES")
  }

  return source.slice(start, end)
}

test("la cola de revisión fiscal expone acción pendiente, resumen de resolución y CTA directo", async () => {
  const listSource = await readSource("components/tax/review/review-queue-list.tsx")
  const badgeSource = await readSource("components/tax/review/review-status-badge.tsx")

  assert.match(listSource, /tax\.review\.pendingAction\.title/)
  assert.match(listSource, /tax\.review\.counterpartyResolution\.title/)
  assert.match(listSource, /tax\.review\.openResolution/)
  assert.match(listSource, /!item\.counterparty_resolution\.conflict_reason/)
  assert.match(badgeSource, /getReviewStatusLabel/)
})

test("los mensajes de revisión fiscal y trimestral ya no dejan labels en inglés en es-ES", async () => {
  const messagesSource = await readSource("lib/i18n/messages.ts")
  const esCatalog = extractSpanishCatalog(messagesSource)

  assert.match(esCatalog, /"tax\.review\.status\.blocked": "Bloquea el cierre"/)
  assert.match(esCatalog, /"tax\.review\.status\.needs_review": "Pendiente de confirmar"/)
  assert.match(esCatalog, /"tax\.review\.summary\.blocked": "Bloqueos"/)
  assert.match(esCatalog, /"tax\.review\.summary\.needsReview": "Pendientes de confirmar"/)
  assert.match(esCatalog, /"tax\.quarters\.status\.review\.ready": "Listo"/)
  assert.match(esCatalog, /"tax\.quarters\.status\.review\.blocked": "Bloqueado"/)
  assert.match(esCatalog, /"tax\.quarters\.status\.review\.needs_review": "Pendiente de confirmar"/)
  assert.doesNotMatch(esCatalog, /"tax\.review\.status\.blocked": "Blocked"/)
  assert.doesNotMatch(esCatalog, /"tax\.review\.status\.needs_review": "Needs review"/)
})
