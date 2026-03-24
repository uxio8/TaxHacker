import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const projectRoot = process.cwd()

async function readProjectFile(relativePath) {
  return readFile(path.resolve(projectRoot, relativePath), "utf8")
}

test("dashboard y settings integran readiness y attention sin tocar el layout visual base", async () => {
  const [dashboardPageSource, settingsPageSource] = await Promise.all([
    readProjectFile("app/(app)/dashboard/page.tsx"),
    readProjectFile("app/(app)/settings/page.tsx"),
  ])

  assert.match(dashboardPageSource, /ReadinessChecklist/)
  assert.match(dashboardPageSource, /AttentionCenter/)
  assert.match(dashboardPageSource, /getAttentionSummary/)
  assert.match(settingsPageSource, /ReadinessChecklist/)
  assert.match(settingsPageSource, /getAttentionSummary/)
  assert.doesNotMatch(dashboardPageSource, /dark:/)
})
