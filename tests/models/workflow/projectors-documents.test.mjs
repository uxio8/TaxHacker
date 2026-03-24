import assert from "node:assert/strict"
import test from "node:test"

const unsortedInboxModule = await import(new URL("../../../models/unsorted-inbox.ts", import.meta.url))
const workflowContractsModule = await import(new URL("../../../models/workflow/contracts.ts", import.meta.url))
const documentsProjectorModule = await import(
  new URL("../../../models/workflow/projectors/documents.ts", import.meta.url)
)

test("buildDocumentWorkflowItems proyecta el inbox documental al contrato de workflow", () => {
  const inboxItems = unsortedInboxModule.buildUnsortedInboxItems(
    [
      {
        id: "file-1",
        filename: "ticket.jpg",
        mimetype: "image/jpeg",
        metadata: {},
        cachedParseResult: null,
      },
      {
        id: "file-2",
        filename: "factura.pdf",
        mimetype: "application/pdf",
        metadata: {
          mobileTriage: {
            source: "mobile_capture",
            disposition: "deferred_to_desktop",
            reasonCode: "low_confidence",
          },
        },
        cachedParseResult: {
          merchant: "Acme",
        },
      },
      {
        id: "file-3",
        filename: "ticket-2.jpg",
        mimetype: "image/jpeg",
        metadata: {},
        cachedParseResult: {
          merchant: "Acme",
        },
      },
    ],
    { llmConfigured: true }
  )

  const items = documentsProjectorModule.buildDocumentWorkflowItems(inboxItems)

  assert.equal(items[0]?.source, workflowContractsModule.WORKFLOW_ITEM_SOURCE.DOCUMENTS)
  assert.equal(items[0]?.recommendedSurface, workflowContractsModule.WORKFLOW_SURFACE.UNSORTED)

  const deferred = items.find((item) => item.id === "file-2")
  assert.equal(deferred?.requiresDesktop, true)
  assert.equal(deferred?.blockingReason, "low_confidence")
  assert.equal(inboxItems.find((item) => item.id === "file-2")?.reasonCode, "low_confidence")
  assert.equal(deferred?.status, workflowContractsModule.WORKFLOW_ITEM_STATUS.NEEDS_ACTION)

  const ready = items.find((item) => item.id === "file-3")
  assert.equal(ready?.status, workflowContractsModule.WORKFLOW_ITEM_STATUS.READY)
  assert.equal(ready?.confidence, workflowContractsModule.WORKFLOW_CONFIDENCE.LOW)
})
