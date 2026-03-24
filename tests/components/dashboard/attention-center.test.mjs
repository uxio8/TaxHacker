import assert from "node:assert/strict"
import test from "node:test"

const readinessModule = await import(new URL("../../../lib/readiness.ts", import.meta.url))
const attentionModule = await import(new URL("../../../lib/attention-contract.ts", import.meta.url))

test("el centro de atención usa un top item y conserva Unsorted como inbox canónico", () => {
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
    unsortedCount: 4,
    deferredToDesktopCount: 1,
    transactionExceptionCount: 2,
    fiscalBlockedCount: 0,
    fiscalNeedsReviewCount: 0,
    activeQuarterLabel: null,
  })

  assert.equal(summary.topItem?.id, "unsorted_review")
  assert.equal(summary.topItem?.recommendedSurface, "unsorted")
  assert.equal(summary.items.find((item) => item.id === "mobile_handoff")?.href, "/unsorted")
})
