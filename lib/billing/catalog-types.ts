export type CapabilityKey =
  | "documents.capture"
  | "documents.ai_analysis"
  | "transactions.workspace"
  | "invoices.workspace"
  | "tax.workspace"
  | "tax.filing"

export type LimitKey = "storage.bytes" | "ai.jobs.monthly" | "members.max"

export type BillingPlanDefinition = {
  code: string
  displayName: string
  description: string
  benefits: string[]
  priceLabel: string
  stripePriceId: string
  limits: Record<LimitKey, number>
  capabilities: CapabilityKey[]
  isAvailable: boolean
  isPublic: boolean
  version: number
}

export type BillingAddonDefinition = {
  code: string
  displayName: string
  description: string
  stripePriceId: string
  benefitLabel: string
  capabilityAdds?: CapabilityKey[]
  limitIncrements?: Partial<Record<LimitKey, number>>
  isAvailable: boolean
  version: number
}

export type CatalogSku =
  | {
      kind: "plan"
      code: string
    }
  | {
      kind: "addon"
      code: string
    }
