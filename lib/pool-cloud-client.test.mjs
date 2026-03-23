import assert from "node:assert/strict"
import test from "node:test"

import {
  buildAcquireLeaseRequest,
  buildCompleteLeaseRequest,
  getPoolCloudClientInstanceId,
} from "./pool-cloud-client.ts"

test("buildAcquireLeaseRequest produces the expected remote runner payload", () => {
  assert.deepEqual(
    buildAcquireLeaseRequest({
      clientInstanceId: "ledgerflow-dev",
      consumerId: "analysis-job-123",
      leaseTtlSec: 300,
    }),
    {
      clientInstanceId: "ledgerflow-dev",
      consumerType: "remote_runner",
      consumerId: "analysis-job-123",
      leaseTtlSec: 300,
    }
  )
})

test("getPoolCloudClientInstanceId prefers explicit configuration and otherwise falls back to hostname", () => {
  assert.equal(
    getPoolCloudClientInstanceId({
      configuredClientInstanceId: "pool-runner-madrid",
      hostname: "ignored-host",
    }),
    "pool-runner-madrid"
  )

  assert.equal(
    getPoolCloudClientInstanceId({
      configuredClientInstanceId: "",
      hostname: "ledgerflow-macbook",
    }),
    "ledgerflow-macbook"
  )
})

test("buildCompleteLeaseRequest incluye los campos opcionales soportados por el pool actual", () => {
  const usageLimitRetryAt = "2026-03-23T00:45:00.000Z"

  assert.deepEqual(
    buildCompleteLeaseRequest({
      outcome: "usage_limited",
      message: "You've hit your usage limit.",
      usageLimitRetryAt,
    }),
    {
      outcome: "usage_limited",
      message: "You've hit your usage limit.",
      usageLimitRetryAt,
    }
  )
})
