import assert from "node:assert/strict"
import test from "node:test"

import {
  buildOrganizationOwnedCodeWhere,
  buildOrganizationOwnedCreateData,
  buildOrganizationOwnedScope,
} from "../../models/organization-owned.ts"

test("buildOrganizationOwnedScope usa organizationId como scope canónico", () => {
  assert.deepEqual(buildOrganizationOwnedScope("org_1"), {
    organizationId: "org_1",
  })
})

test("buildOrganizationOwnedCodeWhere genera la clave compuesta por organización", () => {
  assert.deepEqual(buildOrganizationOwnedCodeWhere("org_1", "default_currency"), {
    organizationId_code: {
      organizationId: "org_1",
      code: "default_currency",
    },
  })
})

test("buildOrganizationOwnedCreateData mantiene compatibilidad temporal con userId", () => {
  assert.deepEqual(
    buildOrganizationOwnedCreateData("org_1", {
      code: "default_currency",
      value: "EUR",
    }),
    {
      organizationId: "org_1",
      userId: "org_1",
      code: "default_currency",
      value: "EUR",
    }
  )
})
