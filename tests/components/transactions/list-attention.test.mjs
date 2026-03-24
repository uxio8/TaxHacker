import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

async function readSource(relativePath) {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8")
}

test("Transactions lista y detalle muestran señales ligeras de excepción", async () => {
  const listSource = await readSource("components/transactions/list.tsx")
  const detailSource = await readSource("app/(app)/transactions/[transactionId]/page.tsx")
  const pageSource = await readSource("app/(app)/transactions/page.tsx")

  assert.match(pageSource, /attentionByTransactionId/)
  assert.match(pageSource, /config\.workflow\.transactionsSliceEnabled/)
  assert.match(pageSource, /getTransactionsWorkflowView/)
  assert.match(listSource, /attentionSignals/)
  assert.match(listSource, /Pendiente fiscal|Sin categoría|Incompleta/)
  assert.match(listSource, /bg-amber-50\/40/)
  assert.match(listSource, /hover:bg-muted\/50/)

  assert.match(detailSource, /getTransactionWorkflowDetailView/)
  assert.match(detailSource, /getLegacyTransactionWorkflowDetailView/)
  assert.match(detailSource, /Requiere revisión/)
  assert.match(detailSource, /view\.fiscalPanel\.document/)
})
