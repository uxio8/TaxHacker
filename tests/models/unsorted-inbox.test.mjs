import assert from "node:assert/strict"
import test from "node:test"

const unsortedInboxModule = await import(new URL("../../models/unsorted-inbox.ts", import.meta.url))

test("buildUnsortedInboxSummary deja pendiente de análisis un documento analizable sin borrador", () => {
  const summary = unsortedInboxModule.buildUnsortedInboxSummary({
    file: {
      id: "file-1",
      filename: "ticket.jpg",
      mimetype: "image/jpeg",
      metadata: {},
      cachedParseResult: null,
    },
    llmConfigured: true,
  })

  assert.equal(summary.id, "file-1")
  assert.equal(summary.state, "pending_analysis")
  assert.equal(summary.reasonCode, null)
  assert.equal(summary.confidenceCode, null)
  assert.equal(summary.primaryAction.kind, "analyze")
  assert.equal(summary.defaultDetailsOpen, false)
})

test("buildUnsortedInboxSummary adelanta los diferidos desde móvil al inbox canónico", () => {
  const summary = unsortedInboxModule.buildUnsortedInboxSummary({
    file: {
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
    llmConfigured: true,
  })

  assert.equal(summary.state, "deferred_to_desktop")
  assert.equal(summary.reasonCode, "low_confidence")
  assert.equal(summary.confidenceCode, "low")
  assert.equal(summary.requiresDesktop, true)
  assert.equal(summary.defaultDetailsOpen, true)
  assert.equal(summary.primaryAction.kind, "open_details")
})

test("buildUnsortedInboxSummary deriva a configuración cuando falta IA", () => {
  const summary = unsortedInboxModule.buildUnsortedInboxSummary({
    file: {
      id: "file-3",
      filename: "ticket.jpg",
      mimetype: "image/jpeg",
      metadata: {},
      cachedParseResult: null,
    },
    llmConfigured: false,
  })

  assert.equal(summary.state, "needs_setup")
  assert.equal(summary.reasonCode, "llm_not_configured")
  assert.equal(summary.primaryAction.kind, "open_settings")
  assert.equal(summary.primaryAction.href, "/settings/llm")
})

test("buildUnsortedInboxSummary deja listo para revisar un documento con borrador", () => {
  const summary = unsortedInboxModule.buildUnsortedInboxSummary({
    file: {
      id: "file-4",
      filename: "factura.pdf",
      mimetype: "application/pdf",
      metadata: {},
      cachedParseResult: {
        merchant: "Acme",
        issuedAt: "2026-03-23",
        total: "12.50",
      },
    },
    llmConfigured: true,
  })

  assert.equal(summary.state, "ready_to_review")
  assert.equal(summary.reasonCode, null)
  assert.equal(summary.confidenceCode, "medium")
  assert.equal(summary.primaryAction.kind, "open_details")
  assert.equal(summary.defaultDetailsOpen, true)
})
