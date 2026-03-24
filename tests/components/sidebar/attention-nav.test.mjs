import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const projectRoot = process.cwd()

async function readProjectFile(relativePath) {
  return readFile(path.resolve(projectRoot, relativePath), "utf8")
}

test("layout, sidebar y mobile menu usan el motor de atención como superficie de guiado", async () => {
  const [layoutSource, sidebarSource, mobileMenuSource] = await Promise.all([
    readProjectFile("app/(app)/layout.tsx"),
    readProjectFile("components/sidebar/sidebar.tsx"),
    readProjectFile("components/sidebar/mobile-menu.tsx"),
  ])

  assert.match(layoutSource, /getNavigationAttentionSummary/)
  assert.match(layoutSource, /attention=\{attention\}/)
  assert.match(sidebarSource, /sidebarGuidance/)
  assert.match(sidebarSource, /setupPendingCount/)
  assert.match(mobileMenuSource, /navAction/)
  assert.match(mobileMenuSource, /attention\.readiness\.mode/)
})
