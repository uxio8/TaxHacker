import assert from "node:assert/strict"
import test from "node:test"

const readinessModule = await import(new URL("../../lib/readiness.ts", import.meta.url))
const attentionModule = await import(new URL("../../lib/attention-contract.ts", import.meta.url))

test("buildAttentionSummary prioriza setup, bloqueos fiscales y luego bandeja operativa", () => {
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

  assert.equal(summary.topItem?.id, "setup_business")
  assert.deepEqual(
    summary.items.slice(0, 4).map((item) => item.id),
    ["setup_business", "setup_fiscal", "tax_blocked", "unsorted_review"]
  )
})

test("buildAttentionSummary incorpora deferred_to_desktop en el inbox canónico", () => {
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
    unsortedCount: 3,
    deferredToDesktopCount: 2,
    transactionExceptionCount: 0,
    fiscalBlockedCount: 0,
    fiscalNeedsReviewCount: 0,
    activeQuarterLabel: null,
  })

  const deferred = summary.items.find((item) => item.id === "mobile_handoff")
  assert.ok(deferred)
  assert.equal(deferred?.href, "/unsorted")
  assert.equal(deferred?.recommendedSurface, "unsorted")
})

test("buildAttentionSummary usa transactions como libro operativo y no como inbox", () => {
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
    transactionExceptionCount: 5,
    fiscalBlockedCount: 0,
    fiscalNeedsReviewCount: 0,
    activeQuarterLabel: null,
  })

  assert.equal(summary.topItem?.id, "transaction_exceptions")
  assert.equal(summary.items[0]?.recommendedSurface, "transactions")
  assert.equal(summary.items[0]?.nextActionLabel, "Revisar libro")
})
