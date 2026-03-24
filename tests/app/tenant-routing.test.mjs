import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

async function readSource(relativePath) {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8")
}

test("el layout autenticado resuelve organización y membresía activas para la shell", async () => {
  const source = await readSource("app/(app)/layout.tsx")

  assert.match(source, /requireCurrentTenantProfile/)
  assert.match(source, /name: currentOrganization\.name/)
  assert.match(source, /role: currentMembership\.role/)
  assert.match(source, /<MobileMenu[\s\S]*currentOrganization=\{/)
  assert.match(source, /<AppSidebar[\s\S]*currentOrganization=\{/)
})

test("la shell muestra el badge de tenant en desktop y móvil", async () => {
  const sidebarSource = await readSource("components/sidebar/sidebar.tsx")
  const mobileSource = await readSource("components/sidebar/mobile-menu.tsx")

  assert.match(sidebarSource, /TenantBadge/)
  assert.match(sidebarSource, /organizationName=\{currentOrganization\.name\}/)
  assert.match(sidebarSource, /role=\{currentOrganization\.role\}/)
  assert.match(mobileSource, /TenantBadge/)
  assert.match(mobileSource, /organizationName=\{currentOrganization\.name\}/)
  assert.match(mobileSource, /role=\{currentOrganization\.role\}/)
})

test("settings, backups y danger exigen rol owner o admin", async () => {
  const settingsActions = await readSource("app/(app)/settings/actions.ts")
  const dangerActions = await readSource("app/(app)/settings/danger/actions.ts")
  const backupActions = await readSource("app/(app)/settings/backups/actions.ts")
  const backupDataRoute = await readSource("app/(app)/settings/backups/data/create-route.ts")

  assert.match(settingsActions, /requireCurrentTenantAdmin/)
  assert.match(settingsActions, /requireSettingsAdmin/)
  assert.match(dangerActions, /await requireCurrentTenantAdmin\(\)/)
  assert.match(backupActions, /await requireCurrentTenantAdmin\(\{/)
  assert.match(backupDataRoute, /await deps\.requireCurrentTenantAdmin\(\{/)
})
