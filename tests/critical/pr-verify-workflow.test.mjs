import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const projectRoot = process.cwd()

async function readProjectFile(relativePath) {
  return readFile(path.resolve(projectRoot, relativePath), "utf8")
}

test("verify:critical:fast expone un harness rápido separado del comando crítico completo", async () => {
  const packageJson = JSON.parse(await readProjectFile("package.json"))
  const runCriticalFastSource = await readProjectFile("tests/critical/run-critical-fast.mjs")

  assert.equal(
    packageJson.scripts["verify:critical:fast"],
    "node --experimental-strip-types tests/critical/run-critical-fast.mjs"
  )
  assert.match(runCriticalFastSource, /Next typegen/)
  assert.match(runCriticalFastSource, /Node critical suites/)
  assert.doesNotMatch(runCriticalFastSource, /Playwright critical smokes/)
})

test("pr-verify valida lint y verify:critical:fast en pull_request", async () => {
  const workflowSource = await readProjectFile(".github/workflows/pr-verify.yml")

  assert.match(workflowSource, /pull_request:/)
  assert.match(workflowSource, /npm run lint/)
  assert.match(workflowSource, /npm run verify:critical:fast/)
  assert.doesNotMatch(workflowSource, /playwright test/)
})
