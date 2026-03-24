import assert from "node:assert/strict"
import test from "node:test"

const readinessModule = await import(new URL("../../lib/readiness.ts", import.meta.url))
const attentionModule = await import(new URL("../../lib/attention-contract.ts", import.meta.url))

test("buildAttentionSummary usa labels humanos y el quickView real para exceptions de transactions", () => {
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
    transactionExceptionCount: 2,
    fiscalBlockedCount: 0,
    fiscalNeedsReviewCount: 0,
    activeQuarterLabel: null,
  })

  assert.equal(summary.items[0]?.title, "Hay registros con excepciones")
  assert.equal(summary.items[0]?.href, "/transactions?quickView=incomplete")
  assert.match(summary.items[0]?.description ?? "", /libro operativo/)
})
