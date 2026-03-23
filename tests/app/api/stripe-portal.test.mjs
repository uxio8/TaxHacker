import assert from "node:assert/strict"
import test from "node:test"

import { createStripePortalRoute } from "../../../app/api/stripe/portal/create-route.ts"

function createStripeClient() {
  const calls = []

  return {
    calls,
    billingPortal: {
      sessions: {
        create: async (input) => {
          calls.push(input)
          return {
            url: "https://billing.stripe.test/session",
          }
        },
      },
    },
  }
}

test("GET /api/stripe/portal devuelve 400 si la organización activa no tiene customer de Stripe", async () => {
  const stripeClient = createStripeClient()
  const handler = createStripePortalRoute({
    stripeClient,
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

  const response = await handler(new Request("http://localhost/api/stripe/portal"))

  assert.equal(response.status, 400)
  assert.equal(stripeClient.calls.length, 0)
  assert.deepEqual(await response.json(), {
    error: "No hay customer de Stripe para la organización activa",
  })
})

test("GET /api/stripe/portal redirige al customer portal de la organización activa", async () => {
  const stripeClient = createStripeClient()
  const handler = createStripePortalRoute({
    stripeClient,
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
    }),
  })

  const response = await handler(new Request("http://localhost/api/stripe/portal"))

  assert.equal(response.status, 307)
  assert.equal(response.headers.get("location"), "https://billing.stripe.test/session")
  assert.deepEqual(stripeClient.calls, [
    {
      customer: "cus_123",
      return_url: "http://localhost/settings/billing",
    },
  ])
})

test("GET /api/stripe/portal devuelve 403 si el usuario no puede gestionar la facturación", async () => {
  const stripeClient = createStripeClient()
  const handler = createStripePortalRoute({
    stripeClient,
    getCurrentUser: async () => ({
      id: "user-1",
      email: "member@example.com",
      defaultOrganizationId: "org-1",
    }),
    requireCurrentTenantAdmin: async () => {
      throw new Error("No tienes permisos para esta acción")
    },
  })

  const response = await handler(new Request("http://localhost/api/stripe/portal"))

  assert.equal(response.status, 403)
  assert.equal(stripeClient.calls.length, 0)
  assert.deepEqual(await response.json(), {
    error: "No tienes permisos para gestionar la facturación de esta empresa",
  })
})
