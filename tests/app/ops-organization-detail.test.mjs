import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const projectRoot = process.cwd()

async function readProjectFile(relativePath) {
  return readFile(path.resolve(projectRoot, relativePath), "utf8")
}

test("ops tiene ficha detallada por organización y navegación desde el listado", async () => {
  const [opsPageSource, detailPageSource, shellSource] = await Promise.all([
    readProjectFile("app/(app)/ops/page.tsx"),
    readProjectFile("app/(app)/ops/organizations/[organizationId]/page.tsx"),
    readProjectFile("components/ops/organization-detail-shell.tsx"),
  ])

  assert.match(opsPageSource, /\/ops\/organizations\/\$\{organization\.id\}/)
  assert.match(detailPageSource, /getOpsOrganizationDetail/)
  assert.match(shellSource, /OrganizationContractCard/)
  assert.match(shellSource, /OrganizationMembersCard/)
  assert.match(shellSource, /OrganizationHealthCard/)
  assert.match(shellSource, /OrganizationSupportCard/)
})

test("la ficha de organización expone acceso rápido para entrar como owner cuando existe", async () => {
  const supportCardSource = await readProjectFile("components/ops/organization-support-card.tsx")

  assert.match(supportCardSource, /Entrar como owner/)
  assert.match(supportCardSource, /startOwnerImpersonationAction/)
})
