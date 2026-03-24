import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const projectRoot = process.cwd()

async function readProjectFile(relativePath) {
  return readFile(path.resolve(projectRoot, relativePath), "utf8")
}

test("transactions queda cableado a la read API estable bajo flag", async () => {
  const [transactionsPageSource, transactionDetailPageSource, configSource] = await Promise.all([
    readProjectFile("app/(app)/transactions/page.tsx"),
    readProjectFile("app/(app)/transactions/[transactionId]/page.tsx"),
    readProjectFile("lib/config.ts"),
  ])

  assert.match(configSource, /WORKFLOW_TRANSACTIONS_SLICE/)
  assert.match(configSource, /transactionsSliceEnabled/)

  assert.match(transactionsPageSource, /config\.workflow\.transactionsSliceEnabled/)
  assert.match(transactionsPageSource, /getTransactionsWorkflowView/)
  assert.match(transactionDetailPageSource, /config\.workflow\.transactionsSliceEnabled/)
  assert.match(transactionDetailPageSource, /getTransactionWorkflowDetailView/)
})
