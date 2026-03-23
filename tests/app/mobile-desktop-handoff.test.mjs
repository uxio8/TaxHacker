import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const projectRoot = process.cwd()

async function readProjectFile(relativePath) {
  return readFile(path.resolve(projectRoot, relativePath), "utf8")
}

test("dashboard y unsorted dejan visible el handoff desde móvil con la misma semántica", async () => {
  const [dashboardPageSource, unsortedPageSource, widgetSource] = await Promise.all([
    readProjectFile("app/(app)/dashboard/page.tsx"),
    readProjectFile("app/(app)/unsorted/page.tsx"),
    readProjectFile("components/dashboard/unsorted-widget.tsx"),
  ])

  assert.match(dashboardPageSource, /buildUnsortedInboxItems/)
  assert.match(widgetSource, /vienen de móvil y esperan escritorio/)
  assert.match(unsortedPageSource, /Revisiones derivadas desde móvil/)
  assert.match(unsortedPageSource, /deferred_to_desktop/)
})
