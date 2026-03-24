import assert from "node:assert/strict"
import test from "node:test"

const readinessModule = await import(new URL("../../../lib/readiness.ts", import.meta.url))
const workflowContractsModule = await import(new URL("../../../models/workflow/contracts.ts", import.meta.url))
const readinessProjectorModule = await import(
  new URL("../../../models/workflow/projectors/readiness.ts", import.meta.url)
)

test("buildReadinessWorkflowItems proyecta solo pasos incompletos", () => {
  const readiness = readinessModule.buildReadinessSummary({
    organizationName: "Acme",
    businessAddress: "",
    llmConfigured: true,
    fiscalProfileReady: false,
    backupReady: false,
    selfHosted: true,
  })

  const items = readinessProjectorModule.buildReadinessWorkflowItems(readiness)

  assert.deepEqual(
    items.map((item) => item.id),
    ["setup_business", "setup_fiscal", "setup_backups"]
  )
  assert.equal(items[0]?.status, workflowContractsModule.WORKFLOW_ITEM_STATUS.BLOCKED)
  assert.equal(items[0]?.recommendedSurface, workflowContractsModule.WORKFLOW_SURFACE.SETTINGS)
  assert.equal(items[2]?.status, workflowContractsModule.WORKFLOW_ITEM_STATUS.NEEDS_ACTION)
})

test("buildReadinessWorkflowItems devuelve vacío cuando readiness está completo", () => {
  const readiness = readinessModule.buildReadinessSummary({
    organizationName: "Acme",
    businessAddress: "Calle Mayor 1",
    llmConfigured: true,
    fiscalProfileReady: true,
    backupReady: true,
    selfHosted: true,
  })

  assert.deepEqual(readinessProjectorModule.buildReadinessWorkflowItems(readiness), [])
})
