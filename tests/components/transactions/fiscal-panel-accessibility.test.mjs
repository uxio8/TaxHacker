import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const componentPath = path.join(
  process.cwd(),
  "components/transactions/fiscal-panel.tsx"
)

test("FiscalPanel expone un nombre accesible explícito para ambos motivos internos", async () => {
  const source = await readFile(componentPath, "utf8")
  const matches = source.match(/aria-label="Motivo interno \(opcional\)"/g) ?? []

  assert.equal(matches.length, 2)
})
