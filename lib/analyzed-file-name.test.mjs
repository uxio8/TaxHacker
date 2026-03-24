import assert from "node:assert/strict"
import test from "node:test"

import { getAnalyzedDocumentTitle, getAnalyzedFileName } from "./analyzed-file-name.ts"

test("getAnalyzedDocumentTitle usa el mismo titulo base que debe ir al campo nombre", () => {
  const title = getAnalyzedDocumentTitle("Documentos escaneados.pdf", {
    invoice_number: "081/0003-488197",
    issuedAt: "2026-03-11",
    merchant: "LEROY MERLIN LA CORUÑA",
  })

  assert.equal(title, "081-0003-488197 (11/03/26) LEROY MERLIN LA CORUÑA")
})

test("getAnalyzedFileName construye el nombre visible con los datos del analisis", () => {
  const filename = getAnalyzedFileName("Documentos escaneados.pdf", {
    invoice_number: "081/0003-488197",
    issuedAt: "2026-03-11",
    merchant: "LEROY MERLIN LA CORUÑA",
  })

  assert.equal(filename, "081-0003-488197 (11-03-26) LEROY MERLIN LA CORUÑA.pdf")
})

test("getAnalyzedFileName conserva el nombre original si el analisis no aporta datos utiles", () => {
  const filename = getAnalyzedFileName("Documentos escaneados.pdf", {
    name: "Bricolaje y materiales de ferretería",
    description: "Compra de materiales",
  })

  assert.equal(filename, "Documentos escaneados.pdf")
})
