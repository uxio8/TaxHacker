import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const projectRoot = process.cwd()

async function readProjectFile(relativePath) {
  return readFile(path.resolve(projectRoot, relativePath), "utf8")
}

test("dashboard, unsorted y capture/inbox quedan cableados a la read API documental bajo flag", async () => {
  const [dashboardPageSource, unsortedPageSource, captureInboxPageSource, configSource] = await Promise.all([
    readProjectFile("app/(app)/dashboard/page.tsx"),
    readProjectFile("app/(app)/unsorted/page.tsx"),
    readProjectFile("app/(app)/capture/inbox/page.tsx"),
    readProjectFile("lib/config.ts"),
  ])

  assert.match(configSource, /WORKFLOW_DOCUMENT_SLICE/)
  assert.match(configSource, /documentSliceEnabled/)

  assert.match(dashboardPageSource, /config\.workflow\.documentSliceEnabled/)
  assert.match(dashboardPageSource, /getDashboardWorkflowDocumentView/)

  assert.match(unsortedPageSource, /config\.workflow\.documentSliceEnabled/)
  assert.match(unsortedPageSource, /getUnsortedWorkflowDocumentView/)

  assert.match(captureInboxPageSource, /config\.workflow\.documentSliceEnabled/)
  assert.match(captureInboxPageSource, /getCaptureWorkflowInboxView/)
})
