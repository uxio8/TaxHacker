import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

test("TransactionPage integra el panel fiscal dentro del detalle de transaccion", async () => {
  const source = await readFile(
    path.resolve(process.cwd(), "app/(app)/transactions/[transactionId]/page.tsx"),
    "utf8"
  )

  assert.match(source, /import\s+\{\s*FiscalPanel\s*\}\s+from\s+"@\/components\/transactions\/fiscal-panel"/)
  assert.match(source, /getTransactionFiscalBySourceTransactionId/)
  assert.match(source, /<FiscalPanel[\s\S]*transactionId=\{transactionId\}/)
})
