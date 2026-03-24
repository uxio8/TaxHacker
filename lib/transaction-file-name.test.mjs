import assert from "node:assert/strict"
import test from "node:test"

import { buildTransactionDocumentTitle, buildTransactionFileName } from "./transaction-file-name.ts"

test("buildTransactionDocumentTitle compone el titulo humano con fecha DD/MM/AA", () => {
  const title = buildTransactionDocumentTitle({
    invoice_number: "FRA/2026-001",
    issuedAt: new Date("2026-03-05T10:00:00.000Z"),
    merchant: "ACME S.L.",
  })

  assert.equal(title, "FRA-2026-001 (05/03/26) ACME S.L")
})

test("buildTransactionFileName compone numero, fecha y comercio manteniendo la extension original", () => {
  const filename = buildTransactionFileName("subida-original.pdf", {
    invoice_number: "FRA/2026-001",
    issuedAt: new Date("2026-03-05T10:00:00.000Z"),
    merchant: "ACME S.L.",
  })

  assert.equal(filename, "FRA-2026-001 (05-03-26) ACME S.L.pdf")
})

test("buildTransactionFileName usa billing_company_name cuando merchant falta", () => {
  const filename = buildTransactionFileName("ticket.jpeg", {
    issuedAt: "2026-01-09",
    billing_company_name: "Proveedor / Norte",
  })

  assert.equal(filename, "(09-01-26) Proveedor Norte.jpeg")
})

test("buildTransactionFileName omite solo las partes ausentes", () => {
  assert.equal(
    buildTransactionFileName("ticket.png", {
      merchant: "Cafeteria Central",
    }),
    "Cafeteria Central.png"
  )

  assert.equal(
    buildTransactionFileName("ticket.png", {
      invoice_number: "INV:2026:77",
    }),
    "INV-2026-77.png"
  )
})

test("buildTransactionFileName devuelve null si no hay datos utiles", () => {
  const filename = buildTransactionFileName("ticket.pdf", {})

  assert.equal(filename, null)
})
