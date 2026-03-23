import assert from "node:assert/strict"
import test from "node:test"

import {
  BILLING_CATALOG_VERSION,
  BILLING_PLANS,
  BILLING_ADDONS,
  getPlanDefinition,
  getAddonDefinition,
  getCatalogSkuByStripePriceId,
} from "./catalog.ts"

test("el catalogo expone planes y addons versionados", () => {
  assert.equal(BILLING_CATALOG_VERSION, 1)
  assert.equal(BILLING_PLANS.early.code, "early")
  assert.equal(BILLING_ADDONS.tax.code, "tax")
})

test("getPlanDefinition y getAddonDefinition resuelven codigos existentes", () => {
  assert.equal(getPlanDefinition("early")?.displayName, "Early Adopter")
  assert.equal(getAddonDefinition("tax")?.displayName, "Fiscal")
  assert.equal(getPlanDefinition("missing"), null)
  assert.equal(getAddonDefinition("missing"), null)
})

test("getCatalogSkuByStripePriceId resuelve planes y addons por price id", () => {
  assert.deepEqual(getCatalogSkuByStripePriceId("price_1RHTj1As8DS4NhOzhejpTN3I"), {
    kind: "plan",
    code: "early",
  })

  assert.equal(getCatalogSkuByStripePriceId("missing"), null)
})
