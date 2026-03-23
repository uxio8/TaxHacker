export const POOL_CLOUD_CONSUMER_TYPE = {
  REMOTE_RUNNER: "remote_runner",
} as const

export const POOL_CLOUD_LEASE_OUTCOME = {
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  CANCELLED: "cancelled",
  TIMED_OUT: "timed_out",
  USAGE_LIMITED: "usage_limited",
  AUTH_INVALID: "auth_invalid",
  WORKSPACE_INVALID: "workspace_invalid",
} as const

export type PoolCloudLeaseOutcome = (typeof POOL_CLOUD_LEASE_OUTCOME)[keyof typeof POOL_CLOUD_LEASE_OUTCOME]

export type PoolCloudConfig = {
  url: string
  token: string
  slug: string
  clientInstanceId?: string
}

export type AcquireLeaseParams = {
  clientInstanceId: string
  consumerId: string
  leaseTtlSec?: number
}

export type AcquireLeaseResponse = {
  leaseId: string
  accountId: string
  sessionId: string
  maskedAccountId: string
  maskedSessionId: string
  expiresAt: string
}

type RenewLeaseResponse = {
  leaseId: string
  expiresAt: string
}

type CompleteLeaseParams = {
  outcome: PoolCloudLeaseOutcome
  message?: string
  usageLimitRetryAt?: string
}

export function buildAcquireLeaseRequest(params: AcquireLeaseParams) {
  return {
    clientInstanceId: params.clientInstanceId,
    consumerType: POOL_CLOUD_CONSUMER_TYPE.REMOTE_RUNNER,
    consumerId: params.consumerId,
    ...(params.leaseTtlSec ? { leaseTtlSec: params.leaseTtlSec } : {}),
  }
}

export function getPoolCloudClientInstanceId(params: {
  configuredClientInstanceId?: string
  hostname: string
}) {
  return params.configuredClientInstanceId || params.hostname || "ledgerflow-runner"
}

export function buildCompleteLeaseRequest(params: CompleteLeaseParams) {
  return {
    outcome: params.outcome,
    ...(params.message ? { message: params.message } : {}),
    ...(params.usageLimitRetryAt ? { usageLimitRetryAt: params.usageLimitRetryAt } : {}),
  }
}

export class PoolCloudClient {
  private readonly config: PoolCloudConfig

  constructor(config: PoolCloudConfig) {
    this.config = config
  }

  async acquireLease(params: AcquireLeaseParams) {
    return this.request<AcquireLeaseResponse>(`/v1/pools/${this.config.slug}/leases/acquire`, {
      method: "POST",
      body: JSON.stringify(buildAcquireLeaseRequest(params)),
    })
  }

  async getAuthSnapshot(leaseId: string) {
    return this.requestText(`/v1/leases/${leaseId}/auth-snapshot`)
  }

  async renewLease(leaseId: string) {
    return this.request<RenewLeaseResponse>(`/v1/leases/${leaseId}/renew`, {
      method: "POST",
    })
  }

  async completeLease(leaseId: string, params: CompleteLeaseParams) {
    return this.request(`/v1/leases/${leaseId}/complete`, {
      method: "POST",
      body: JSON.stringify(buildCompleteLeaseRequest(params)),
    })
  }

  async releaseLease(leaseId: string, reason?: string) {
    return this.request(`/v1/leases/${leaseId}/release`, {
      method: "POST",
      body: JSON.stringify({
        ...(reason ? { reason } : {}),
      }),
    })
  }

  private async request<T>(path: string, init: RequestInit = {}) {
    const response = await fetch(this.getUrl(path), {
      ...init,
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    })

    if (!response.ok) {
      throw new Error(`Pool Cloud request failed with ${response.status}`)
    }

    if (response.status === 204) {
      return null as T
    }

    return response.json() as Promise<T>
  }

  private async requestText(path: string) {
    const response = await fetch(this.getUrl(path), {
      headers: {
        Authorization: `Bearer ${this.config.token}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Pool Cloud request failed with ${response.status}`)
    }

    return response.text()
  }

  private getUrl(path: string) {
    return `${this.config.url.replace(/\/+$/, "")}${path}`
  }
}
