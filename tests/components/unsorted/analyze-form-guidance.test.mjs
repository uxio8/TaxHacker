import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const projectRoot = process.cwd()

async function readProjectFile(relativePath) {
  return readFile(path.resolve(projectRoot, relativePath), "utf8")
}

test("AnalyzeForm usa resumen guiado y progressive disclosure sin romper la card actual", async () => {
  const [formSource, pageSource] = await Promise.all([
    readProjectFile("components/unsorted/analyze-form.tsx"),
    readProjectFile("app/(app)/unsorted/page.tsx"),
  ])

  assert.match(formSource, /summary\.primaryAction/)
  assert.match(formSource, /isDetailsOpen/)
  assert.match(formSource, /summary\.defaultDetailsOpen/)
  assert.match(pageSource, /buildUnsortedInboxItems/)
  assert.match(pageSource, /summary=\{summary\}/)
})

test("AnalyzeForm expone borrado directo para archivos pendientes de análisis", async () => {
  const formSource = await readProjectFile("components/unsorted/analyze-form.tsx")

  assert.match(formSource, /effectiveSummary\.state === "pending_analysis"[\s\S]*deleteAction\(file\.id\)/)
})

test("AnalyzeForm recalcula la cabecera desde el borrador local cuando la IA devuelve datos", async () => {
  const formSource = await readProjectFile("components/unsorted/analyze-form.tsx")

  assert.match(formSource, /buildUnsortedInboxSummary/)
  assert.match(formSource, /localCachedParseResult/)
  assert.match(formSource, /effectiveSummary\s*=\s*useMemo/)
  assert.match(formSource, /effectiveSummary\.primaryAction/)
})
