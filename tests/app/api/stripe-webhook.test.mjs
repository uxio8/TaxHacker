import assert from "node:assert/strict"
import test from "node:test"

import { createStripeWebhookRoute } from "../../../app/api/stripe/webhook/create-route.ts"

test("POST /api/stripe/webhook devuelve 400 si falta la firma o el secreto", async () => {
  const handler = createStripeWebhookRoute({
    webhookSecret: "whsec_test",
    stripeClient: {
      webhooks: {
        constructEvent() {
          throw new Error("no debería ejecutarse")
        },
      },
    },
  })

  const response = await handler(
    new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: JSON.stringify({}),
    })
  )

  assert.equal(response.status, 400)
  assert.equal(await response.text(), "Webhook signature or secret missing")
})

test("POST /api/stripe/webhook sincroniza checkout.session.completed contra la organización correcta", async () => {
  const recordedEvents = []
  const syncedSubscriptions = []
  const stripeClient = {
    webhooks: {
      constructEvent(body, signature, secret) {
        assert.equal(body, "{\"ok\":true}")
        assert.equal(signature, "sig_test")
        assert.equal(secret, "whsec_test")

        return {
          id: "evt_123",
          created: 1_711_195_000,
          type: "checkout.session.completed",
          data: {
            object: {
              subscription: "sub_123",
              client_reference_id: "org_client_ref",
              metadata: {
                organizationId: "org_meta",
              },
            },
          },
        }
      },
    },
    subscriptions: {
      async retrieve(subscriptionId) {
        assert.equal(subscriptionId, "sub_123")
        return {
          id: "sub_123",
          customer: "cus_123",
          status: "active",
          cancel_at_period_end: false,
          items: {
            data: [
              {
                current_period_start: 1_710_000_000,
                current_period_end: 1_712_592_000,
                price: {
                  id: "price_early",
                },
              },
            ],
          },
          metadata: {},
        }
      },
    },
  }

  const handler = createStripeWebhookRoute({
    webhookSecret: "whsec_test",
    stripeClient,
    syncOrganizationSubscriptionFromStripeSubscription: async (subscription, options) => {
      syncedSubscriptions.push({ subscription, options })
      return {
        organizationId: options.fallbackOrganizationId,
      }
    },
    recordBillingEvent: async (event) => {
      recordedEvents.push(event)
    },
  })

  const response = await handler(
    new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: "{\"ok\":true}",
      headers: {
        "stripe-signature": "sig_test",
      },
    })
  )

  assert.equal(response.status, 200)
  assert.equal(await response.text(), "Webhook processed successfully")
  assert.equal(syncedSubscriptions.length, 1)
  assert.deepEqual(syncedSubscriptions[0].options, {
    fallbackOrganizationId: "org_meta",
    stripeEventId: "evt_123",
    stripeEventCreatedAt: new Date(1_711_195_000 * 1000),
  })
  assert.deepEqual(recordedEvents, [
    {
      organizationId: "org_meta",
      provider: "stripe",
      eventType: "checkout.session.completed",
      externalEventId: "evt_123",
      payload: {
        id: "evt_123",
        created: 1_711_195_000,
        type: "checkout.session.completed",
        data: {
          object: {
            subscription: "sub_123",
            client_reference_id: "org_client_ref",
            metadata: {
              organizationId: "org_meta",
            },
          },
        },
      },
      processedAt: recordedEvents[0]?.processedAt,
    },
  ])
  assert.ok(recordedEvents[0].processedAt instanceof Date)
})
