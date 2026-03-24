import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const componentPaths = [
  "components/transactions/fiscal-panel.tsx",
  "components/transactions/fiscal-panel/counterparty-section.tsx",
  "components/transactions/fiscal-panel/payment-date-section.tsx",
  "components/transactions/fiscal-panel/period-override-section.tsx",
].map((relativePath) => path.join(process.cwd(), relativePath))

test("FiscalPanel expone un nombre accesible explícito para ambos motivos internos", async () => {
  const sources = await Promise.all(componentPaths.map((componentPath) => readFile(componentPath, "utf8")))
  const matches = sources.flatMap((source) => source.match(/aria-label="Motivo interno \(opcional\)"/g) ?? [])

  assert.equal(matches.length, 2)
})
