import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

async function readSource(relativePath) {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8")
}

test("Quick views y resumen activo viven en el bloque de filtros de Transactions", async () => {
  const quickViewsSource = await readSource("components/transactions/quick-views.tsx")
  const filtersSource = await readSource("components/transactions/filters.tsx")

  assert.match(quickViewsSource, /TransactionFilterQuickViews/)
  assert.match(quickViewsSource, /quickViews\.map/)
  assert.match(quickViewsSource, /quickView\.code/)
  assert.match(quickViewsSource, /setFilters\(/)

  assert.match(filtersSource, /TransactionFilterQuickViews/)
  assert.match(filtersSource, /buildTransactionFilterSummary/)
  assert.match(filtersSource, /Filtros activos/)
  assert.match(filtersSource, /const \[filters, setFilters\] = useTransactionFilters/)
  assert.match(filtersSource, /quickViews=\{quickViews\}/)
})
