import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

async function readSource(relativePath) {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8")
}

test("el cockpit de obligaciones expone las dimensiones operativas clave", async () => {
  const cockpitSource = await readSource("components/tax/obligations/obligations-cockpit.tsx")
  const cardSource = await readSource("components/tax/obligations/obligation-status-card.tsx")

  assert.match(cockpitSource, /ObligationStatusCard/)
  assert.match(cardSource, /Vencimiento/)
  assert.match(cardSource, /Readiness/)
  assert.match(cardSource, /Bloqueos/)
  assert.match(cardSource, /Responsable/)
  assert.match(cardSource, /Siguiente accion|Siguiente acción/)
})

test("el hub fiscal conecta el cockpit con las obligaciones trimestrales clave", async () => {
  const pageSource = await readSource("app/(app)/tax/page.tsx")
  const sectionsSource = await readSource("components/tax/layout/tax-workspace-sections.tsx")

  assert.match(pageSource, /loadModel303ForTenant/)
  assert.match(pageSource, /loadModel115DraftForTenant/)
  assert.match(pageSource, /loadModel111ManualForTenant/)
  assert.match(pageSource, /syncFiscalObligationsForOrganization/)
  assert.match(pageSource, /getFiscalObligationByCodeAndPeriod/)
  assert.match(pageSource, /code:\s*"303"/)
  assert.match(pageSource, /code:\s*"115"/)
  assert.match(pageSource, /code:\s*"111"/)
  assert.match(pageSource, /obligations=\{obligationsCockpit\}/)
  assert.match(sectionsSource, /ObligationsCockpit/)
  assert.match(sectionsSource, /obligations\??:/)
})

test("el hub fiscal expone una capa anual resumida con enlace al handoff", async () => {
  const pageSource = await readSource("app/(app)/tax/page.tsx")
  const sectionsSource = await readSource("components/tax/layout/tax-workspace-sections.tsx")
  const annualCardSource = await readSource("components/tax/obligations/annual-fiscal-overview-card.tsx")

  assert.match(pageSource, /getAnnualHandoffPackForOrganization|buildAnnualHandoffPack/)
  assert.match(pageSource, /annualOverview|annualHandoff/)
  assert.match(pageSource, /responsibleLabel:/)
  assert.match(pageSource, /nextActionLabel:/)
  assert.match(pageSource, /nextActionHref:/)
  assert.match(sectionsSource, /AnnualFiscalOverviewCard/)
  assert.match(sectionsSource, /annualOverview\??:/)
  assert.match(annualCardSource, /Responsable/)
  assert.match(annualCardSource, /Siguiente accion|Siguiente acción/)
})
