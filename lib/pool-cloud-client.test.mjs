import assert from "node:assert/strict"
import test from "node:test"

import {
  buildAcquireLeaseRequest,
  getPoolCloudClientInstanceId,
} from "./pool-cloud-client.ts"

test("buildAcquireLeaseRequest produces the expected remote runner payload", () => {
  assert.deepEqual(
    buildAcquireLeaseRequest({
      clientInstanceId: "taxhacker-dev",
      consumerId: "analysis-job-123",
      leaseTtlSec: 300,
    }),
    {
      clientInstanceId: "taxhacker-dev",
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
      hostname: "taxhacker-macbook",
    }),
    "taxhacker-macbook"
  )
})
