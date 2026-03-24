import Stripe from "stripe"
import config from "./config"
import { BILLING_PLANS } from "./billing/catalog"

export const stripeClient: Stripe | null = config.stripe.secretKey
  ? new Stripe(config.stripe.secretKey, {
      apiVersion: "2025-03-31.basil",
    })
  : null

export type Plan = {
  code: string
  name: string
  description: string
  benefits: string[]
  price: string
  stripePriceId: string
  limits: {
    storage: number
    ai: number
  }
  isAvailable: boolean
}

export const PLANS: Record<string, Plan> = {
  ...Object.fromEntries(
    Object.values(BILLING_PLANS).map((plan) => [
      plan.code,
      {
        code: plan.code,
        name: plan.displayName,
        description: plan.description,
        benefits: plan.benefits,
        price: plan.priceLabel,
        stripePriceId: plan.stripePriceId,
        limits: {
          storage: plan.limits["storage.bytes"],
          ai: plan.limits["ai.jobs.monthly"],
        },
        isAvailable: plan.isAvailable,
      } satisfies Plan,
    ])
  ),
}
