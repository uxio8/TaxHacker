import assert from "node:assert/strict"
import test from "node:test"

import {
  buildTransactionOwnedCreateData,
  buildTransactionOwnedIdWhere,
  buildTransactionOwnedScope,
} from "../../models/transaction-owned.ts"

test("buildTransactionOwnedScope usa organizationId como scope canónico", () => {
  assert.deepEqual(buildTransactionOwnedScope("org_1"), {
    organizationId: "org_1",
  })
})

test("buildTransactionOwnedIdWhere genera la clave compuesta id+organizationId", () => {
  assert.deepEqual(buildTransactionOwnedIdWhere("tx_1", "org_1"), {
    id_organizationId: {
      id: "tx_1",
      organizationId: "org_1",
    },
  })
})

test("buildTransactionOwnedCreateData persiste userId real y organizationId", () => {
  assert.deepEqual(
    buildTransactionOwnedCreateData("user_1", "org_1", {
      merchant: "Proveedor Demo",
      total: 1299,
    }),
    {
      userId: "user_1",
      organizationId: "org_1",
      merchant: "Proveedor Demo",
      total: 1299,
    }
  )
})
