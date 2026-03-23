import assert from "node:assert/strict"
import test from "node:test"

import {
  classifyPoolCloudLeaseCompletion,
  POOL_CLOUD_COMPLETION_REASON,
} from "./pool-cloud-lease-feedback.ts"

test("classifyPoolCloudLeaseCompletion marca workspace_invalid para workspaces desactivados", () => {
  const completion = classifyPoolCloudLeaseCompletion(
    'unexpected status 402 Payment Required: {"detail":{"code":"deactivated_workspace"}}'
  )

  assert.equal(completion.outcome, "workspace_invalid")
  assert.equal(completion.reason, POOL_CLOUD_COMPLETION_REASON.WORKSPACE_INVALID)
})

test("classifyPoolCloudLeaseCompletion marca usage_limited y extrae retryAt cuando viene en el mensaje", () => {
  const completion = classifyPoolCloudLeaseCompletion(
    "You've hit your usage limit. Try again at 2026-03-23T00:45:00.000Z."
  )

  assert.equal(completion.outcome, "usage_limited")
  assert.equal(completion.reason, POOL_CLOUD_COMPLETION_REASON.USAGE_LIMITED)
  assert.equal(completion.usageLimitRetryAt, "2026-03-23T00:45:00.000Z")
})

test("classifyPoolCloudLeaseCompletion marca auth_invalid para errores de autenticación", () => {
  const completion = classifyPoolCloudLeaseCompletion(
    "Auth session expired. Please run codex login again."
  )

  assert.equal(completion.outcome, "auth_invalid")
  assert.equal(completion.reason, POOL_CLOUD_COMPLETION_REASON.AUTH_INVALID)
})

test("classifyPoolCloudLeaseCompletion deja failed para errores genéricos", () => {
  const completion = classifyPoolCloudLeaseCompletion("Codex command failed")

  assert.equal(completion.outcome, "failed")
  assert.equal(completion.reason, POOL_CLOUD_COMPLETION_REASON.GENERIC_FAILURE)
})
