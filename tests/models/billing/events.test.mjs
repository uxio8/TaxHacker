import assert from "node:assert/strict"
import test from "node:test"

import { listRecentBillingEventsByOrganization, recordBillingEvent } from "../../../models/billing/events.ts"

function createStore(overrides = {}) {
  const baseStore = {
    billingEvent: {
      create: async () => null,
      findMany: async () => [],
    },
  }

  return {
    ...baseStore,
    ...overrides,
  }
}

test("recordBillingEvent ignora duplicados de Stripe con externalEventId", async () => {
  await recordBillingEvent(
    {
      organizationId: "org-1",
      provider: "stripe",
      eventType: "customer.subscription.updated",
      externalEventId: "evt_123",
      payload: { ok: true },
      processedAt: new Date("2026-03-23T00:00:00.000Z"),
    },
    createStore({
      billingEvent: {
        create: async () => {
          const error = new Error("duplicate")
          error.code = "P2002"
          throw error
        },
        findMany: async () => [],
      },
    })
  )
})

test("listRecentBillingEventsByOrganization devuelve los eventos recientes del tenant", async () => {
  const rows = await listRecentBillingEventsByOrganization(
    "org-1",
    5,
    createStore({
      billingEvent: {
        create: async () => null,
        findMany: async (args) => {
          assert.deepEqual(args, {
            where: { organizationId: "org-1" },
            orderBy: { createdAt: "desc" },
            take: 5,
          })

          return [
            {
              id: "be_1",
              eventType: "customer.subscription.updated",
              externalEventId: "evt_1",
              processedAt: new Date("2026-03-23T00:00:00.000Z"),
              createdAt: new Date("2026-03-23T00:00:00.000Z"),
            },
          ]
        },
      },
    })
  )

  assert.equal(rows.length, 1)
  assert.equal(rows[0].id, "be_1")
})
