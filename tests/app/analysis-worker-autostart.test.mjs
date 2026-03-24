import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

test("startAnalysisJobAction rearma el worker al reutilizar o crear jobs de analisis", async () => {
  const source = await readFile(path.resolve(process.cwd(), "app/(app)/unsorted/actions.ts"), "utf8")

  assert.match(source, /ensureAnalysisWorkerRunning/)
  assert.match(source, /await\s+ensureAnalysisWorkerForJob\(activeJob\.id\)/)
  assert.match(source, /await\s+ensureAnalysisWorkerForJob\(job\.id\)/)
})

test("el polling de analysis jobs rearma el worker si el job sigue activo", async () => {
  const source = await readFile(path.resolve(process.cwd(), "app/api/analysis-jobs/[jobId]/route.ts"), "utf8")

  assert.match(source, /ensureAnalysisWorkerRunning/)
  assert.match(source, /ACTIVE_ANALYSIS_JOB_STATUSES/)
  assert.match(source, /await\s+ensureAnalysisWorkerRunning\(\{\s*currentJobId:\s*job\.id\s*\}\)/)
})
