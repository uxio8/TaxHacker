import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const projectRoot = process.cwd()

async function readProjectFile(relativePath) {
  return readFile(path.resolve(projectRoot, relativePath), "utf8")
}

test("ops incorpora filtros y tarjetas resumen sin romper la estética actual", async () => {
  const [opsPageSource, filtersSource, cardsSource] = await Promise.all([
    readProjectFile("app/(app)/ops/page.tsx"),
    readProjectFile("components/ops/ops-dashboard-filters.tsx"),
    readProjectFile("components/ops/ops-summary-cards.tsx"),
  ])

  assert.match(opsPageSource, /OpsSummaryCards/)
  assert.match(opsPageSource, /OpsDashboardFilters/)
  assert.match(filtersSource, /planCode/)
  assert.match(filtersSource, /billingStatus/)
  assert.match(filtersSource, /accessStatus/)
  assert.match(cardsSource, /Trial/)
  assert.match(cardsSource, /Soporte activo/)
  assert.doesNotMatch(cardsSource, /dark:/)
})

test("ops expone un formulario para crear empresas desde superadmin", async () => {
  const [opsPageSource, createFormSource, actionsSource] = await Promise.all([
    readProjectFile("app/(app)/ops/page.tsx"),
    readProjectFile("components/ops/create-organization-form.tsx"),
    readProjectFile("app/(app)/ops/actions.ts"),
  ])

  assert.match(opsPageSource, /CreateOrganizationForm/)
  assert.match(opsPageSource, /xl:grid-cols-\[minmax\(0,1\.4fr\)_minmax\(0,1fr\)\]/)
  assert.match(createFormSource, /Crear empresa/)
  assert.match(createFormSource, /Email del owner/)
  assert.match(createFormSource, /Usuarios iniciales/)
  assert.match(createFormSource, /Añadir usuario/)
  assert.doesNotMatch(createFormSource, /CardTitle/)
  assert.match(actionsSource, /redirect\(`\/ops\/organizations\/\$\{created\.organization\.id\}`\)/)
})
