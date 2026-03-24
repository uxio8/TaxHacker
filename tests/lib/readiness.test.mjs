import assert from "node:assert/strict"
import { mkdtemp, mkdir, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"

const readinessModule = await import(new URL("../../lib/readiness.ts", import.meta.url))

test("buildReadinessSummary mantiene setup hasta completar empresa, IA y fiscal", () => {
  const summary = readinessModule.buildReadinessSummary({
    organizationName: "Acme",
    businessAddress: "",
    llmConfigured: false,
    fiscalProfileReady: false,
    backupReady: false,
    selfHosted: true,
  })

  assert.equal(summary.mode, "setup")
  assert.equal(summary.isReady, false)
  assert.equal(summary.nextStep?.key, "business")
  assert.equal(summary.steps.find((step) => step.key === "business")?.complete, false)
  assert.equal(summary.steps.find((step) => step.key === "llm")?.blocking, true)
  assert.equal(summary.steps.find((step) => step.key === "backups")?.blocking, false)
})

test("buildReadinessSummary pasa a operación diaria cuando solo falta backup básico", () => {
  const summary = readinessModule.buildReadinessSummary({
    organizationName: "Acme",
    businessAddress: "Calle Mayor 1",
    llmConfigured: true,
    fiscalProfileReady: true,
    backupReady: false,
    selfHosted: true,
  })

  assert.equal(summary.mode, "daily")
  assert.equal(summary.isReady, false)
  assert.equal(summary.nextStep?.key, "backups")
  assert.equal(summary.completedCount, 3)
})

test("buildReadinessSummary queda listo cuando todos los pasos están completos", () => {
  const summary = readinessModule.buildReadinessSummary({
    organizationName: "Acme",
    businessAddress: "Calle Mayor 1",
    llmConfigured: true,
    fiscalProfileReady: true,
    backupReady: true,
    selfHosted: true,
  })

  assert.equal(summary.mode, "daily")
  assert.equal(summary.isReady, true)
  assert.equal(summary.nextStep, null)
  assert.equal(summary.completedCount, summary.totalCount)
})

test("detectLocalBackupBaseline detecta snapshots locales cuando existe al menos una carpeta", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "ledgerflow-readiness-"))

  try {
    assert.equal(await readinessModule.detectLocalBackupBaseline(tempRoot), false)
    await mkdir(path.join(tempRoot, "20260323-120000"))
    assert.equal(await readinessModule.detectLocalBackupBaseline(tempRoot), true)
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})
