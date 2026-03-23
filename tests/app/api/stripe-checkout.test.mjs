import assert from "node:assert/strict"
import test from "node:test"

import { createStripeCheckoutRoute } from "../../../app/api/stripe/checkout/create-route.ts"

function createStripeClient() {
  const calls = []

  return {
    calls,
    checkout: {
      sessions: {
        create: async (input, options) => {
          calls.push({ input, options })
          return {
            id: "cs_test_123",
            url: "https://checkout.stripe.test/session",
          }
        },
      },
    },
  }
}

test("POST /api/stripe/checkout devuelve 409 si la organización ya tiene billing activo", async () => {
  const stripeClient = createStripeClient()
  const handler = createStripeCheckoutRoute({
    stripeClient,
    plans: {
      early: {
        code: "early",
        stripePriceId: "price_early",
        isAvailable: true,
      },
    },
    getCurrentUser: async () => ({
      id: "user-1",
      email: "owner@example.com",
      defaultOrganizationId: "org-1",
    }),
    requireCurrentOrganization: async () => ({
      id: "org-1",
      name: "Acme SL",
    }),
    requireCurrentTenantAdmin: async () => ({
      role: "owner",
    }),
    getOrganizationContract: async () => ({
      stripeCustomerId: "cus_123",
      billingStatus: "active",
    }),
  })

  const response = await handler(new Request("http://localhost/api/stripe/checkout?code=early", { method: "POST" }))

  assert.equal(response.status, 409)
  assert.equal(stripeClient.calls.length, 0)
  assert.deepEqual(await response.json(), {
    error: "Esta empresa ya tiene facturacion activa. Usa el portal de cliente.",
  })
})

test("POST /api/stripe/checkout crea una sesión de Stripe vinculada a la organización activa", async () => {
  const stripeClient = createStripeClient()
  const handler = createStripeCheckoutRoute({
    stripeClient,
    paymentSuccessUrl: "https://tax.example.com/cloud/payment/success",
    plans: {
      early: {
        code: "early",
        stripePriceId: "price_early",
        isAvailable: true,
      },
    },
    getAddonDefinition: (code) =>
      code === "tax"
        ? {
            code: "tax",
            stripePriceId: "price_tax",
            isAvailable: true,
          }
        : null,
    getCurrentUser: async () => ({
      id: "user-1",
      email: "owner@example.com",
      defaultOrganizationId: "org-1",
    }),
    requireCurrentOrganization: async () => ({
      id: "org-1",
      name: "Acme SL",
    }),
    requireCurrentTenantAdmin: async () => ({
      role: "owner",
    }),
    getOrganizationContract: async () => null,
  })

  const response = await handler(
    new Request("http://localhost/api/stripe/checkout?code=early&addon=tax&addon=tax", { method: "POST" })
  )

  assert.equal(response.status, 200)
  assert.equal(stripeClient.calls.length, 1)
  assert.deepEqual(stripeClient.calls[0], {
    input: {
      billing_address_collection: "auto",
      line_items: [
        {
          price: "price_early",
          quantity: 1,
        },
        {
          price: "price_tax",
          quantity: 1,
        },
      ],
      mode: "subscription",
      automatic_tax: {
        enabled: true,
      },
      allow_promotion_codes: true,
      client_reference_id: "org-1",
      customer: undefined,
      customer_email: "owner@example.com",
      metadata: {
        organizationId: "org-1",
        planCode: "early",
        addonCodes: JSON.stringify(["tax"]),
      },
      subscription_data: {
        metadata: {
          organizationId: "org-1",
          planCode: "early",
          addonCodes: JSON.stringify(["tax"]),
        },
      },
      success_url: "https://tax.example.com/cloud/payment/success",
      cancel_url: "http://localhost/settings/billing",
    },
    options: {
      idempotencyKey: "billing-checkout:org-1:early:tax",
    },
  })
  assert.deepEqual(await response.json(), {
    session: {
      id: "cs_test_123",
      url: "https://checkout.stripe.test/session",
    },
  })
})

test("POST /api/stripe/checkout devuelve 403 si el usuario no puede gestionar la facturación", async () => {
  const stripeClient = createStripeClient()
  const handler = createStripeCheckoutRoute({
    stripeClient,
    plans: {
      early: {
        code: "early",
        stripePriceId: "price_early",
        isAvailable: true,
      },
    },
    getCurrentUser: async () => ({
      id: "user-1",
      email: "member@example.com",
      defaultOrganizationId: "org-1",
    }),
    requireCurrentTenantAdmin: async () => {
      throw new Error("No tienes permisos para esta acción")
    },
  })

  const response = await handler(new Request("http://localhost/api/stripe/checkout?code=early", { method: "POST" }))

  assert.equal(response.status, 403)
  assert.equal(stripeClient.calls.length, 0)
  assert.deepEqual(await response.json(), {
    error: "No tienes permisos para gestionar la facturación de esta empresa",
  })
})
