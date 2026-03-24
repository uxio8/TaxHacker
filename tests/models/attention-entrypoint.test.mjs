import assert from "node:assert/strict"
import test from "node:test"

const attentionModule = await import(new URL("../../models/attention.ts", import.meta.url))

test("models/attention reexporta el entrypoint público operativo", async () => {
  const summary = await attentionModule.getNavigationAttentionSummary(
    {
      organizationId: "org_1",
      organizationName: "Acme SL",
      userId: "user_1",
      businessAddress: "Calle Mayor 1",
      selfHosted: true,
    },
    {
      getSettings: async () => ({ llm_provider_1: "pool_cloud" }),
      getLLMSettings: () => ({ providers: [{ provider: "pool_cloud" }] }),
      getUnsortedFiles: async () => [{ isReviewed: false, metadata: null }],
      getFiscalProfileAccessByOrganizationId: async () => ({
        status: "ready",
        profile: { id: "profile_1" },
      }),
      getFiscalReviewQueue: async () => ({
        summary: {
          blocked: 1,
          needs_review: 0,
        },
      }),
      detectLocalBackupBaseline: async () => true,
    }
  )

  assert.equal(typeof attentionModule.getAttentionSummary, "function")
  assert.equal(typeof attentionModule.getNavigationAttentionSummary, "function")
  assert.equal(summary.counts.unsorted, 1)
  assert.equal(summary.counts.fiscalBlocked, 1)
})
