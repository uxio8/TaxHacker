import assert from "node:assert/strict"
import test from "node:test"

import {
  resolveStripeCheckoutSessionOrganizationId,
  shouldSyncStripeCheckoutSuccess,
} from "../../../models/billing/checkout-success.ts"

test("resolveStripeCheckoutSessionOrganizationId prioriza metadata.organizationId", () => {
  assert.equal(
    resolveStripeCheckoutSessionOrganizationId({
      metadata: {
        organizationId: "org-meta",
      },
      client_reference_id: "org-client-ref",
    }),
    "org-meta"
  )
})

test("resolveStripeCheckoutSessionOrganizationId usa client_reference_id cuando falta metadata", () => {
  assert.equal(
    resolveStripeCheckoutSessionOrganizationId({
      client_reference_id: "org-client-ref",
    }),
    "org-client-ref"
  )
})

test("shouldSyncStripeCheckoutSuccess solo permite sync si la sesión corresponde a la organización activa", () => {
  assert.equal(
    shouldSyncStripeCheckoutSuccess(
      {
        metadata: {
          organizationId: "org-1",
        },
      },
      "org-1"
    ),
    true
  )

  assert.equal(
    shouldSyncStripeCheckoutSuccess(
      {
        metadata: {
          organizationId: "org-2",
        },
      },
      "org-1"
    ),
    false
  )

  assert.equal(
    shouldSyncStripeCheckoutSuccess(
      {
        client_reference_id: null,
      },
      "org-1"
    ),
    false
  )
})
