import assert from "node:assert/strict"
import test from "node:test"

const readinessModule = await import(new URL("../../../lib/readiness.ts", import.meta.url))
const attentionModule = await import(new URL("../../../lib/attention-contract.ts", import.meta.url))
const unsortedInboxModule = await import(new URL("../../../models/unsorted-inbox.ts", import.meta.url))
const workflowContractsModule = await import(new URL("../../../models/workflow/contracts.ts", import.meta.url))
const workflowReadApiModule = await import(new URL("../../../models/workflow/read-api.ts", import.meta.url))

test("buildWorkflowItemsFromAttentionSummary convierte atención en items de workflow estables", () => {
  const readiness = readinessModule.buildReadinessSummary({
    organizationName: "Acme",
    businessAddress: "",
    llmConfigured: true,
    fiscalProfileReady: false,
    backupReady: false,
    selfHosted: true,
  })

  const summary = attentionModule.buildAttentionSummary({
    readiness,
    unsortedCount: 6,
    deferredToDesktopCount: 2,
    transactionExceptionCount: 3,
    fiscalBlockedCount: 4,
    fiscalNeedsReviewCount: 1,
    activeQuarterLabel: "2026-Q1",
  })

  const items = workflowReadApiModule.buildWorkflowItemsFromAttentionSummary(summary)

  assert.equal(items[0]?.id, "setup_business")
  assert.equal(items[0]?.source, workflowContractsModule.WORKFLOW_ITEM_SOURCE.READINESS)
  assert.equal(items[0]?.recommendedSurface, workflowContractsModule.WORKFLOW_SURFACE.SETTINGS)
  assert.equal(items[0]?.status, workflowContractsModule.WORKFLOW_ITEM_STATUS.BLOCKED)

  const fiscalBlocked = items.find((item) => item.id === "tax_blocked")
  assert.equal(fiscalBlocked?.source, workflowContractsModule.WORKFLOW_ITEM_SOURCE.FISCAL)
  assert.equal(fiscalBlocked?.recommendedSurface, workflowContractsModule.WORKFLOW_SURFACE.TAX)
  assert.equal(fiscalBlocked?.materiality, workflowContractsModule.WORKFLOW_MATERIALITY.HIGH)
})

test("buildWorkflowDocumentItemsFromUnsortedInbox conserva la semántica del inbox documental", () => {
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
    ],
    {
      llmConfigured: true,
    }
  )

  const items = workflowReadApiModule.buildWorkflowDocumentItemsFromUnsortedInbox(inboxItems)

  const pendingAnalysis = items.find((item) => item.id === "file-1")
  assert.equal(pendingAnalysis?.status, workflowContractsModule.WORKFLOW_ITEM_STATUS.NEEDS_ACTION)
  assert.equal(pendingAnalysis?.nextAction.kind, "analyze")
  assert.equal(pendingAnalysis?.recommendedSurface, workflowContractsModule.WORKFLOW_SURFACE.UNSORTED)
  assert.equal(pendingAnalysis?.source, workflowContractsModule.WORKFLOW_ITEM_SOURCE.DOCUMENTS)

  const deferredToDesktop = items.find((item) => item.id === "file-2")
  assert.equal(deferredToDesktop?.status, workflowContractsModule.WORKFLOW_ITEM_STATUS.NEEDS_ACTION)
  assert.equal(deferredToDesktop?.requiresDesktop, true)
  assert.equal(deferredToDesktop?.blockingReason, "low_confidence")
  assert.equal(deferredToDesktop?.recommendedSurface, workflowContractsModule.WORKFLOW_SURFACE.UNSORTED)
})

test("buildWorkflowReadModelFromAttention expone readiness, items y postura desde una API estable", () => {
  const readiness = readinessModule.buildReadinessSummary({
    organizationName: "Acme",
    businessAddress: "Calle Mayor 1",
    llmConfigured: true,
    fiscalProfileReady: true,
    backupReady: true,
    selfHosted: true,
  })

  const summary = attentionModule.buildAttentionSummary({
    readiness,
    unsortedCount: 0,
    deferredToDesktopCount: 0,
    transactionExceptionCount: 0,
    fiscalBlockedCount: 0,
    fiscalNeedsReviewCount: 0,
    activeQuarterLabel: "2026-Q1",
  })

  const model = workflowReadApiModule.buildWorkflowReadModelFromAttention(summary)

  assert.equal(model.readiness.isReady, true)
  assert.equal(model.items.length, 0)
  assert.equal(model.posture.code, workflowContractsModule.PERIOD_CLOSURE_POSTURE.ON_TRACK)
})
