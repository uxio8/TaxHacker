import assert from "node:assert/strict"
import test from "node:test"

import { getTenantStorageUsed } from "../../../lib/files.ts"

test("getTenantStorageUsed agrega todos los namespaces legacy de una organización durante la migración", async () => {
  const total = await getTenantStorageUsed(
    {
      organizationId: "org-1",
    },
    {
      listOrganizationLegacyStorageNamespaces: async () => ["owner@example.com", "member@example.com", "user-1"],
      listOrganizationStoredObjects: async () => [
        { objectKey: "organizations/org-1/uploads/unsorted/a.pdf", size: 100 },
      ],
      getStorageProviderKind: () => "local",
      getDirectorySize: async (directoryPath) => {
        if (directoryPath.endsWith("owner@example.com")) {
          return 10
        }

        if (directoryPath.endsWith("member@example.com")) {
          return 20
        }

        if (directoryPath.endsWith("user-1")) {
          return 30
        }

        return 0
      },
    }
  )

  assert.equal(total, 160)
})

test("getTenantStorageUsed no duplica namespaces legacy repetidos ni mezcla el namespace canónico", async () => {
  const total = await getTenantStorageUsed(
    {
      organizationId: "org-1",
      legacyUserNamespaces: ["owner@example.com", "owner@example.com", "organizations/org-1"],
    },
    {
      listOrganizationStoredObjects: async () => [
        { objectKey: "organizations/org-1/uploads/unsorted/a.pdf", size: 100 },
      ],
      getStorageProviderKind: () => "local",
      getDirectorySize: async (directoryPath) => {
        if (directoryPath.endsWith("owner@example.com")) {
          return 10
        }

        if (directoryPath.endsWith("organizations/org-1")) {
          throw new Error("no debe medir el namespace canónico como legacy")
        }

        return 0
      },
    }
  )

  assert.equal(total, 110)
})
