import assert from "node:assert/strict"
import test from "node:test"

const workflowContractsModule = await import(new URL("../../../models/workflow/contracts.ts", import.meta.url))
const rebuildModule = await import(new URL("../../../models/workflow/rebuild.ts", import.meta.url))

test("buildWorkflowReadModelFromSlices ordena items y calcula postura de cierre", () => {
  const model = rebuildModule.buildWorkflowReadModelFromSlices({
    readiness: {
      mode: "setup",
      isReady: false,
      completedCount: 2,
      totalCount: 4,
      nextStep: null,
      steps: [],
    },
    items: [
      {
        id: "tax_blocked",
        title: "Bloqueo fiscal",
        description: "Hay un bloqueo",
        href: "/tax",
        count: 1,
        status: workflowContractsModule.WORKFLOW_ITEM_STATUS.BLOCKED,
        source: workflowContractsModule.WORKFLOW_ITEM_SOURCE.FISCAL,
        recommendedSurface: workflowContractsModule.WORKFLOW_SURFACE.TAX,
        materiality: workflowContractsModule.WORKFLOW_MATERIALITY.HIGH,
        confidence: workflowContractsModule.WORKFLOW_CONFIDENCE.CONFIRMED,
        nextAction: {
          kind: "open",
          label: "Abrir fiscal",
          href: "/tax",
        },
        blockingReason: "missing_receipt",
        requiresDesktop: false,
      },
      {
        id: "transaction:tx-1",
        title: "Excepción de libro",
        description: "Hay que revisar el libro",
        href: "/transactions/tx-1",
        count: 1,
        status: workflowContractsModule.WORKFLOW_ITEM_STATUS.NEEDS_ACTION,
        source: workflowContractsModule.WORKFLOW_ITEM_SOURCE.TRANSACTIONS,
        recommendedSurface: workflowContractsModule.WORKFLOW_SURFACE.TRANSACTIONS,
        materiality: workflowContractsModule.WORKFLOW_MATERIALITY.MEDIUM,
        confidence: workflowContractsModule.WORKFLOW_CONFIDENCE.CONFIRMED,
        nextAction: {
          kind: "open",
          label: "Abrir libro",
          href: "/transactions/tx-1",
        },
        blockingReason: null,
        requiresDesktop: false,
      },
    ],
  })

  assert.equal(model.topItem?.id, "tax_blocked")
  assert.equal(model.posture.code, workflowContractsModule.PERIOD_CLOSURE_POSTURE.BLOCKED)
})
