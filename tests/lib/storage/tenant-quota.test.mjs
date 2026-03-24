import assert from "node:assert/strict"
import test from "node:test"

import { getTenantStorageUsed, isEnoughStorageToUploadFile } from "../../../lib/files.ts"

function createUser(overrides = {}) {
  return {
    id: "user-1",
    email: "owner@example.com",
    organizationId: "org-1",
    storageLimit: 1_000,
    storageUsed: 0,
    ...overrides,
  }
}

test("isEnoughStorageToUploadFile usa el almacenamiento real del tenant y no user.storageUsed stale", async () => {
  const result = await isEnoughStorageToUploadFile(
    createUser({ storageUsed: 0 }),
    100,
    {
      getTenantStorageUsed: async () => 950,
      getStorageLimit: async () => 1_000,
    }
  )

  assert.equal(result, false)
})

test("isEnoughStorageToUploadFile permite subir si el plan es ilimitado", async () => {
  const result = await isEnoughStorageToUploadFile(createUser({ storageLimit: -1 }), 10_000_000, {
    getStorageLimit: async () => -1,
    getTenantStorageUsed: async () => {
      throw new Error("no debe consultarse")
    },
  })

  assert.equal(result, true)
})

test("getTenantStorageUsed suma objetos canónicos del provider y namespaces legacy en local", async () => {
  const total = await getTenantStorageUsed(
    {
      organizationId: "org-1",
      userEmailOrId: "owner@example.com",
      legacyUserNamespaces: ["member@example.com"],
    },
    {
      listOrganizationStoredObjects: async () => [
        { objectKey: "organizations/org-1/uploads/unsorted/a.pdf", size: 100 },
        { objectKey: "organizations/org-1/uploads/unsorted/a.pdf", size: 100 },
        { objectKey: "organizations/org-1/derived/previews/a/1.webp", size: 25 },
      ],
      getStorageProviderKind: () => "local",
      getDirectorySize: async (directoryPath) => {
        if (directoryPath.endsWith("owner@example.com")) {
          return 10
        }

        if (directoryPath.endsWith("member@example.com")) {
          return 15
        }

        return 0
      },
    }
  )

  assert.equal(total, 150)
})

test("getTenantStorageUsed usa solo el provider cuando el storage no es local", async () => {
  const total = await getTenantStorageUsed(
    {
      organizationId: "org-1",
      legacyUserNamespaces: ["owner@example.com"],
    },
    {
      listOrganizationStoredObjects: async () => [
        { objectKey: "organizations/org-1/uploads/unsorted/a.pdf", size: 80 },
      ],
      getStorageProviderKind: () => "s3",
      getDirectorySize: async () => {
        throw new Error("no debe leer directorios legacy en S3")
      },
    }
  )

  assert.equal(total, 80)
})
