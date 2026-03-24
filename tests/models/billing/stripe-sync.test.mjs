import assert from "node:assert/strict"
import test from "node:test"

import { BILLING_PLANS } from "../../../lib/billing/catalog.ts"
import {
  extractCatalogSelectionFromPriceIds,
  syncOrganizationSubscriptionFromStripeSubscription,
} from "../../../models/billing/stripe-sync.ts"

test("extractCatalogSelectionFromPriceIds separa plan y addons conocidos", () => {
  const selection = extractCatalogSelectionFromPriceIds([
    BILLING_PLANS.early.stripePriceId,
    "price_unknown",
  ])

  assert.equal(selection.planCode, "early")
  assert.deepEqual(selection.addonCodes, [])
})

test("syncOrganizationSubscriptionFromStripeSubscription propaga metadatos de orden del evento Stripe", async () => {
  const calls = []

  await syncOrganizationSubscriptionFromStripeSubscription(
    {
      id: "sub_123",
      customer: "cus_123",
      status: "active",
      cancel_at_period_end: false,
      created: 1_711_190_400,
      metadata: {
        organizationId: "org-1",
      },
      items: {
        data: [
          {
            current_period_start: 1_711_190_400,
            current_period_end: 1_713_782_400,
            price: {
              id: BILLING_PLANS.early.stripePriceId,
            },
          },
        ],
      },
    },
    {
      stripeEventId: "evt_123",
      stripeEventCreatedAt: new Date("2026-03-23T12:00:00.000Z"),
    },
    {
      findOrganizationContractByStripeCustomerId: async () => null,
      syncOrganizationSubscriptionContract: async (input) => {
        calls.push(input)
        return {
          organizationId: input.organizationId,
        }
      },
    }
  )

  assert.equal(calls.length, 1)
  assert.equal(calls[0].stripeEventId, "evt_123")
  assert.deepEqual(calls[0].stripeEventCreatedAt, new Date("2026-03-23T12:00:00.000Z"))
})
