import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

import { CRITICAL_DRIFT_THRESHOLDS, CRITICAL_SURFACES } from "./surfaces.mjs"

const projectRoot = process.cwd()

async function readProjectFile(relativePath) {
  return readFile(path.resolve(projectRoot, relativePath), "utf8")
}

test("verify:critical expone el harness crítico mínimo", async () => {
  const packageJson = JSON.parse(await readProjectFile("package.json"))
  const runCriticalSource = await readProjectFile("tests/critical/run-critical.mjs")

  assert.equal(packageJson.scripts["verify:critical"], "node --experimental-strip-types tests/critical/run-critical.mjs")
  assert.match(runCriticalSource, /Next typegen/)
  assert.match(runCriticalSource, /typegen/)
})

test("el catálogo crítico cubre las siete superficies y exige suites reales", () => {
  assert.equal(CRITICAL_SURFACES.length, 7)
  assert.deepEqual(CRITICAL_DRIFT_THRESHOLDS, {
    typeErrors: 0,
    nodeSuiteFailures: 0,
    playwrightFailures: 0,
    uncoveredCriticalSurfaces: 0,
  })

  for (const surface of CRITICAL_SURFACES) {
    assert.ok(surface.id)
    assert.ok(surface.rollbackFlag)
    assert.ok(surface.nodeTests.length > 0)
  }
})

test("la spec documenta superficies, thresholds y rollback por flag", async () => {
  const specSource = await readProjectFile("docs/superpowers/specs/2026-03-24-compatibility-harness-contract.md")

  assert.match(specSource, /dashboard/)
  assert.match(specSource, /unsorted/)
  assert.match(specSource, /capture/)
  assert.match(specSource, /tax/)
  assert.match(specSource, /archive/)
  assert.match(specSource, /transactions/)
  assert.match(specSource, /ops/)
  assert.match(specSource, /typeErrors: 0/)
  assert.match(specSource, /rollback/i)
  assert.match(specSource, /PLAYWRIGHT_BASE_URL/)
})
