import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const projectRoot = process.cwd()

async function readProjectFile(relativePath) {
  return readFile(path.resolve(projectRoot, relativePath), "utf8")
}

test("TaxPage resuelve la atencion fiscal guiada y la pasa al layout", async () => {
  const source = await readProjectFile("app/(app)/tax/page.tsx")

  assert.match(source, /import\s+\{\s*getCurrentUser\s*\}\s+from\s+"@\/lib\/auth"/)
  assert.match(source, /import\s+\{\s*requireCurrentOrganizationId\s*\}\s+from\s+"@\/lib\/tenant"/)
  assert.match(source, /import\s+\{\s*getFiscalProfileAccessByOrganizationId\s*\}\s+from\s+"@\/models\/fiscal\/profile"/)
  assert.match(source, /import\s+\{\s*getTaxAttention\s*\}\s+from\s+"@\/models\/tax-attention"/)
  assert.match(source, /<TaxWorkspaceHeader[\s\S]*attention=\{attention\}/)
  assert.match(source, /<TaxWorkspaceSections[\s\S]*attention=\{attention\}/)
})

test("TaxWorkspaceSections coloca la siguiente accion guiada antes del grid de modulos", async () => {
  const [sectionsSource, actionCardSource] = await Promise.all([
    readProjectFile("components/tax/layout/tax-workspace-sections.tsx"),
    readProjectFile("components/tax/layout/tax-next-action-card.tsx"),
  ])

  assert.match(sectionsSource, /import\s+\{\s*TaxNextActionCard\s*\}\s+from\s+"@\/components\/tax\/layout\/tax-next-action-card"/)
  assert.match(sectionsSource, /<TaxNextActionCard/)
  assert.ok(sectionsSource.indexOf("<TaxNextActionCard") < sectionsSource.indexOf("TAX_WORKSPACE_MODULES.map"))
  assert.match(sectionsSource, /tax\.review\.summary\.blocked/)
  assert.match(sectionsSource, /tax\.review\.summary\.needsReview/)

  assert.match(actionCardSource, /nextAction\.href/)
  assert.match(actionCardSource, /setupHref/)
  assert.match(actionCardSource, /tax\.modules\.open|tax\.review\.setup\.action/)
})
