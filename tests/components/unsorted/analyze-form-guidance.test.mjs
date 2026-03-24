import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const projectRoot = process.cwd()

async function readProjectFile(relativePath) {
  return readFile(path.resolve(projectRoot, relativePath), "utf8")
}

test("AnalyzeForm usa resumen guiado y progressive disclosure sin romper la card actual", async () => {
  const [formSource, headerSource, detailsSource, pageSource] = await Promise.all([
    readProjectFile("components/unsorted/analyze-form.tsx"),
    readProjectFile("components/unsorted/analyze-form/header.tsx"),
    readProjectFile("components/unsorted/analyze-form/details.tsx"),
    readProjectFile("app/(app)/unsorted/page.tsx"),
  ])

  assert.match(formSource, /from "@\/components\/unsorted\/analyze-form\/header"/)
  assert.match(formSource, /from "@\/components\/unsorted\/analyze-form\/details"/)
  assert.match(formSource, /isDetailsOpen/)
  assert.match(formSource, /summary\.defaultDetailsOpen/)
  assert.match(headerSource, /summary\.primaryAction/)
  assert.match(detailsSource, /data-save-button/)
  assert.match(pageSource, /buildUnsortedInboxItems/)
  assert.match(pageSource, /summary=\{summary\}/)
})

test("AnalyzeForm expone borrado directo para archivos pendientes de análisis", async () => {
  const [formSource, headerSource, detailsSource] = await Promise.all([
    readProjectFile("components/unsorted/analyze-form.tsx"),
    readProjectFile("components/unsorted/analyze-form/header.tsx"),
    readProjectFile("components/unsorted/analyze-form/details.tsx"),
  ])

  assert.match(formSource, /effectiveSummary\.state === "pending_analysis"/)
  assert.match(formSource, /const handleDelete = \(\) =>/)
  assert.match(formSource, /deleteAction\(file\.id\)/)
  assert.match(headerSource, /onDelete/)
  assert.match(detailsSource, /onDelete/)
})

test("AnalyzeForm recalcula la cabecera desde el borrador local cuando la IA devuelve datos", async () => {
  const [formSource, derivedStateSource, pollingSource] = await Promise.all([
    readProjectFile("components/unsorted/analyze-form.tsx"),
    readProjectFile("components/unsorted/analyze-form/derived-state.ts"),
    readProjectFile("components/unsorted/analyze-form/poll-analysis-job.ts"),
  ])

  assert.match(formSource, /localCachedParseResult/)
  assert.match(formSource, /effectiveSummary\s*=\s*useMemo/)
  assert.match(formSource, /buildAnalyzeFormDerivedState/)
  assert.match(derivedStateSource, /buildUnsortedInboxSummary/)
  assert.match(derivedStateSource, /INVOICE_FIELD_CODES/)
  assert.match(pollingSource, /\/api\/analysis-jobs\//)
  assert.match(pollingSource, /ANALYSIS_JOB_TIMEOUT_MS/)
})
