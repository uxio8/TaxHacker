import assert from "node:assert/strict"
import test from "node:test"

import {
  recoverStaleAnalysisJobs,
  STALE_ANALYSIS_JOB_STATUSES,
} from "./analysis-worker-recovery.ts"

test("recoverStaleAnalysisJobs marks stale in-progress jobs as failed", async () => {
  const calls = []
  const now = new Date("2026-03-20T20:00:00.000Z")
  const expectedThreshold = new Date("2026-03-20T19:49:00.000Z")
  const prisma = {
    analysisJob: {
      async updateMany(args) {
        calls.push(args)
        return { count: 2 }
      },
    },
  }

  const recoveredJobs = await recoverStaleAnalysisJobs(prisma, {
    now,
    staleAfterMs: 11 * 60 * 1000,
  })

  assert.equal(recoveredJobs, 2)
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].where, {
    status: {
      in: [...STALE_ANALYSIS_JOB_STATUSES],
    },
    updatedAt: {
      lt: expectedThreshold,
    },
  })
  assert.deepEqual(calls[0].data, {
    status: "failed",
    error: "Analysis worker stopped before completing this job. Please retry the analysis.",
    finishedAt: now,
  })
})
