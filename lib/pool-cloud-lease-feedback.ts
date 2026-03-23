import {
  POOL_CLOUD_LEASE_OUTCOME,
  type PoolCloudLeaseOutcome,
} from "./pool-cloud-client.ts"

export const POOL_CLOUD_COMPLETION_REASON = {
  AUTH_INVALID: "auth_invalid",
  GENERIC_FAILURE: "generic_failure",
  USAGE_LIMITED: "usage_limited",
  WORKSPACE_INVALID: "workspace_invalid",
} as const

export type PoolCloudCompletionReason =
  (typeof POOL_CLOUD_COMPLETION_REASON)[keyof typeof POOL_CLOUD_COMPLETION_REASON]

export type PoolCloudLeaseCompletion = {
  outcome: PoolCloudLeaseOutcome
  reason: PoolCloudCompletionReason
  message: string
  usageLimitRetryAt?: string
}

const WORKSPACE_INVALID_PATTERNS = [
  /deactivated_workspace/i,
  /workspace_invalid/i,
  /workspace (?:is )?deactivated/i,
  /payment required/i,
  /billing/i,
] as const

const AUTH_INVALID_PATTERNS = [
  /auth_invalid/i,
  /auth session expired/i,
  /codex login/i,
  /invalid_grant/i,
  /invalid refresh token/i,
  /401 unauthorized/i,
  /unauthorized/i,
] as const

const USAGE_LIMITED_PATTERNS = [
  /usage limit/i,
  /quota exceeded/i,
  /rate limit/i,
  /too many requests/i,
  /quota_blocked/i,
  /429\b/i,
] as const

const ISO_TIMESTAMP_PATTERN = /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/

export function classifyPoolCloudLeaseCompletion(error: unknown): PoolCloudLeaseCompletion {
  const message = normalizePoolCloudErrorMessage(error)

  if (matchesPoolCloudPattern(message, WORKSPACE_INVALID_PATTERNS)) {
    return {
      outcome: POOL_CLOUD_LEASE_OUTCOME.WORKSPACE_INVALID,
      reason: POOL_CLOUD_COMPLETION_REASON.WORKSPACE_INVALID,
      message,
    }
  }

  if (matchesPoolCloudPattern(message, AUTH_INVALID_PATTERNS)) {
    return {
      outcome: POOL_CLOUD_LEASE_OUTCOME.AUTH_INVALID,
      reason: POOL_CLOUD_COMPLETION_REASON.AUTH_INVALID,
      message,
    }
  }

  if (matchesPoolCloudPattern(message, USAGE_LIMITED_PATTERNS)) {
    return {
      outcome: POOL_CLOUD_LEASE_OUTCOME.USAGE_LIMITED,
      reason: POOL_CLOUD_COMPLETION_REASON.USAGE_LIMITED,
      message,
      usageLimitRetryAt: extractUsageLimitRetryAt(message),
    }
  }

  return {
    outcome: POOL_CLOUD_LEASE_OUTCOME.FAILED,
    reason: POOL_CLOUD_COMPLETION_REASON.GENERIC_FAILURE,
    message,
  }
}

function matchesPoolCloudPattern(message: string, patterns: readonly RegExp[]) {
  return patterns.some((pattern) => pattern.test(message))
}

function normalizePoolCloudErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.trim() || "Pool Cloud analysis failed"
  }

  if (typeof error === "string") {
    return error.trim() || "Pool Cloud analysis failed"
  }

  return "Pool Cloud analysis failed"
}

function extractUsageLimitRetryAt(message: string) {
  const match = message.match(ISO_TIMESTAMP_PATTERN)
  return match?.[0]
}
