import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

test("MobileCaptureUploader ofrece foto con capture environment y subida de imagen o PDF", async () => {
  const source = await readFile(
    path.resolve(process.cwd(), "components/capture/mobile-capture-uploader.tsx"),
    "utf8"
  )

  assert.match(source, /fetch\("\/api\/mobile\/capture"/)
  assert.match(source, /capture="environment"/)
  assert.match(source, /accept="image\/\*"/)
  assert.match(source, /accept="image\/\*,application\/pdf"/)
  assert.match(source, /Hacer foto/)
  assert.match(source, /Subir PDF\/imagen/)
})

test("MobileInbox hace polling mientras haya items analizando y muestra banner de sistema", async () => {
  const source = await readFile(path.resolve(process.cwd(), "components/capture/mobile-inbox.tsx"), "utf8")

  assert.match(source, /shouldPollInbox/)
  assert.match(source, /setTimeout/)
  assert.match(source, /\/api\/mobile\/inbox/)
  assert.match(source, /getSystemStatusBanner/)
})

test("MobileReview expone preview, campos criticos y acciones de triaje rapido", async () => {
  const source = await readFile(path.resolve(process.cwd(), "components/capture/mobile-review.tsx"), "utf8")

  assert.match(source, /merchant/)
  assert.match(source, /issuedAt/)
  assert.match(source, /total/)
  assert.match(source, /currencyCode/)
  assert.match(source, /invoiceNumber/)
  assert.match(source, /categoryCode/)
  assert.match(source, /Aceptar/)
  assert.match(source, /Corregir criticos/)
  assert.match(source, /Reintentar analisis/)
  assert.match(source, /Seguir en escritorio/)
})
