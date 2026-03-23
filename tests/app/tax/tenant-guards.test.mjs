import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

async function readSource(relativePath) {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8")
}

function assertUsesFiscalTenantResolver(source) {
  assert.match(source, /(getFiscalProfileAccessByOrganizationId|loadModel111ManualForTenant|loadModel180DraftForTenant|loadModel390DraftForTenant|getModel347Gate|getModel349Gate)/)
}

test("las pantallas fiscales resuelven el tenant activo antes de leer datos", async () => {
  const reviewPage = await readSource("app/(app)/tax/review/page.tsx")
  const quartersPage = await readSource("app/(app)/tax/quarters/page.tsx")
  const archivePage = await readSource("app/(app)/tax/archive/page.tsx")
  const annualArchivePage = await readSource("app/(app)/tax/archive/annual/page.tsx")
  const formsPage = await readSource("app/(app)/tax/forms/page.tsx")
  const form111Page = await readSource("app/(app)/tax/forms/111/page.tsx")
  const form180Page = await readSource("app/(app)/tax/forms/180/page.tsx")
  const form390Page = await readSource("app/(app)/tax/forms/390/page.tsx")
  const form347Page = await readSource("app/(app)/tax/forms/347/page.tsx")
  const form349Page = await readSource("app/(app)/tax/forms/349/page.tsx")
  const closePage = await readSource("app/(app)/tax/close/page.tsx")
  const fiscalSettingsPage = await readSource("app/(app)/settings/fiscal/page.tsx")

  for (const source of [
    reviewPage,
    quartersPage,
    archivePage,
    annualArchivePage,
    formsPage,
    form111Page,
    form180Page,
    form390Page,
    form347Page,
    form349Page,
    closePage,
    fiscalSettingsPage,
  ]) {
    assert.match(source, /requireCurrentOrganizationId/)
  }

  for (const source of [
    reviewPage,
    archivePage,
    annualArchivePage,
    form111Page,
    form180Page,
    form390Page,
    form347Page,
    form349Page,
    fiscalSettingsPage,
  ]) {
    assertUsesFiscalTenantResolver(source)
  }
})

test("las acciones fiscales bloquean el acceso cruzado usando organizationId", async () => {
  const closeActions = await readSource("app/(app)/tax/close/actions.ts")
  const counterpartyActions = await readSource("app/(app)/tax/counterparties/actions.ts")
  const transactionFiscalActions = await readSource("app/(app)/transactions/fiscal-actions.ts")

  assert.match(closeActions, /const organizationId = await requireCurrentWritableOrganizationId/)
  assert.match(closeActions, /getFiscalProfileAccessByOrganizationId\(organizationId, user\.id\)/)
  assert.match(counterpartyActions, /const organizationId = await requireCurrentWritableOrganizationId/)
  assert.match(counterpartyActions, /getFiscalProfileAccessByOrganizationId\(organizationId, user\.id\)/)
  assert.match(transactionFiscalActions, /const organizationId = await requireCurrentWritableOrganizationId/)
  assert.match(transactionFiscalActions, /organizationId,/)
})
