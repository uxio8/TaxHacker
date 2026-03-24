import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

async function readSource(relativePath) {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8")
}

test("Transactions usa quick views reales en URL y servidor", async () => {
  const modelSource = await readSource("models/transactions.ts")
  const hookSource = await readSource("hooks/use-transaction-filters.tsx")
  const pageSource = await readSource("app/(app)/transactions/page.tsx")

  assert.match(modelSource, /quickView\?:\s*TransactionQuickView/)
  assert.match(modelSource, /TRANSACTION_QUICK_VIEWS/)
  assert.match(modelSource, /missing_category/)
  assert.match(modelSource, /incomplete/)
  assert.match(modelSource, /pending_fiscal/)
  assert.match(modelSource, /current_quarter/)
  assert.match(modelSource, /categoryCode:\s*null/)
  assert.match(modelSource, /reviewStatus:\s*\{\s*in:\s*\[/)
  assert.match(modelSource, /startOfQuarter\(/)
  assert.match(modelSource, /endOfQuarter\(/)
  assert.match(modelSource, /isTransactionIncomplete\(/)
  assert.match(modelSource, /getFields\(/)

  assert.match(hookSource, /"quickView"/)
  assert.match(hookSource, /searchParams\.set\("quickView"/)
  assert.match(hookSource, /router\.replace\(/)
  assert.match(hookSource, /areFiltersEqual\(/)

  assert.match(pageSource, /normalizeTransactionFilters\(await searchParams\)/)
  assert.match(pageSource, /getTransactions\(organizationId,\s*filters,/)
  assert.match(pageSource, /quickViews=\{TRANSACTION_QUICK_VIEW_OPTIONS\}/)
  assert.match(pageSource, /getTransactionAttentionSignals\(transaction,\s*fields\)/)
})
