import assert from "node:assert/strict"
import test from "node:test"

const workflowContractsModule = await import(new URL("../../../models/workflow/contracts.ts", import.meta.url))
const fiscalProjectorModule = await import(new URL("../../../models/workflow/projectors/fiscal.ts", import.meta.url))

test("buildFiscalWorkflowItems proyecta obligaciones y expedientes al contrato de workflow", () => {
  const items = fiscalProjectorModule.buildFiscalWorkflowItems({
    obligations: [
      {
        id: "obl-1",
        code: "303",
        periodKey: "2026-Q1",
        status: "waiting_on_documents",
        owner: "advisor",
        dueDate: "2026-04-20T00:00:00.000Z",
        blockingReasons: [],
      },
      {
        id: "obl-2",
        code: "115",
        periodKey: "2026-Q1",
        status: "needs_review",
        owner: "advisor",
        dueDate: "2026-04-20T00:00:00.000Z",
        blockingReasons: ["missing_receipt"],
      },
      {
        id: "obl-3",
        code: "390",
        periodKey: "2026-Y",
        status: "ready_to_file",
        owner: "advisor",
        dueDate: "2027-01-30T00:00:00.000Z",
        blockingReasons: [],
      },
      {
        id: "obl-4",
        code: "180",
        periodKey: "2026-Y",
        status: "filed",
        owner: "advisor",
        dueDate: "2027-01-30T00:00:00.000Z",
        blockingReasons: [],
      },
    ],
    dossiersByObligationId: {
      "obl-4": {
        filingReceiptFileId: null,
      },
    },
  })

  const waiting = items.find((item) => item.id === "obligation:obl-1")
  assert.equal(waiting?.status, workflowContractsModule.WORKFLOW_ITEM_STATUS.NEEDS_ACTION)

  const blocked = items.find((item) => item.id === "obligation:obl-2")
  assert.equal(blocked?.status, workflowContractsModule.WORKFLOW_ITEM_STATUS.BLOCKED)
  assert.equal(blocked?.blockingReason, "missing_receipt")

  const ready = items.find((item) => item.id === "obligation:obl-3")
  assert.equal(ready?.status, workflowContractsModule.WORKFLOW_ITEM_STATUS.READY)

  const receipt = items.find((item) => item.id === "dossier:obl-4:missing_receipt")
  assert.equal(receipt?.status, workflowContractsModule.WORKFLOW_ITEM_STATUS.BLOCKED)
  assert.equal(receipt?.source, workflowContractsModule.WORKFLOW_ITEM_SOURCE.ARCHIVE)
})
