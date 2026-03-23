import assert from "node:assert/strict"
import test from "node:test"

import {
  buildFileStorageMigrationPlan,
  buildStaticAssetMigrationPlan,
  migrateStorage,
} from "../../scripts/migrate-storage.ts"

function createFileRecord(overrides = {}) {
  return {
    id: "file_1",
    userId: "user_1",
    organizationId: "org_1",
    filename: "ticket.pdf",
    path: "uploads/unsorted/file_1.pdf",
    isReviewed: false,
    createdAt: new Date("2026-03-20T10:00:00.000Z"),
    metadata: null,
    ...overrides,
  }
}

function createTransactionRecord(overrides = {}) {
  return {
    id: "tx_1",
    userId: "user_1",
    organizationId: "org_1",
    merchant: "ACME SL",
    name: "Factura proveedor",
    issuedAt: new Date("2026-03-05T00:00:00.000Z"),
    extra: {
      invoice_number: "F-2026-001",
    },
    files: ["file_1"],
    ...overrides,
  }
}

function createUserRecord(overrides = {}) {
  return {
    id: "user_1",
    email: "owner@example.com",
    defaultOrganizationId: "org_1",
    avatar: "/files/static/avatar.webp?user_1",
    businessLogo: "/files/static/businessLogo.png",
    ...overrides,
  }
}

test("buildFileStorageMigrationPlan mueve un unsorted legacy a clave canónica por organización", () => {
  const plan = buildFileStorageMigrationPlan({
    file: createFileRecord(),
    linkedTransaction: null,
  })

  assert.deepEqual(plan, {
    fileId: "file_1",
    organizationId: "org_1",
    sourceStoredPath: "uploads/unsorted/file_1.pdf",
    targetStoredPath: "organizations/org_1/uploads/unsorted/file_1.pdf",
    kind: "unsorted",
    reason: "legacy_unsorted",
    filename: "ticket.pdf",
    shouldUpdateDatabase: true,
  })
})

test("buildFileStorageMigrationPlan mueve un reviewed legacy a ruta transaccional canónica", () => {
  const plan = buildFileStorageMigrationPlan({
    file: createFileRecord({
      isReviewed: true,
      path: "2026/03/ticket.pdf",
    }),
    linkedTransaction: createTransactionRecord(),
  })

  assert.deepEqual(plan, {
    fileId: "file_1",
    organizationId: "org_1",
    sourceStoredPath: "2026/03/ticket.pdf",
    targetStoredPath: "organizations/org_1/uploads/transactions/file_1/2026/03/F-2026-001 (05-03-26) ACME SL.pdf",
    kind: "transaction",
    reason: "legacy_reviewed_transaction",
    filename: "F-2026-001 (05-03-26) ACME SL.pdf",
    shouldUpdateDatabase: true,
  })
})

test("buildStaticAssetMigrationPlan convierte avatar legacy a URL estática canónica", () => {
  const plan = buildStaticAssetMigrationPlan({
    user: createUserRecord(),
    field: "avatar",
  })

  assert.deepEqual(plan, {
    userId: "user_1",
    organizationId: "org_1",
    field: "avatar",
    sourceStoredPath: "avatar.webp",
    targetStoredPath: "organizations/org_1/static/avatar/user_1.webp",
    nextUrl: "/files/static/organizations/org_1/static/avatar/user_1.webp",
    assetType: "avatar",
  })
})

test("migrateStorage en dry-run reporta cambios sin escribir nada", async () => {
  const writes = []
  const fileUpdates = []
  const userUpdates = []

  const result = await migrateStorage(
    {
      dryRun: true,
      organizationId: "org_1",
    },
    {
      listFiles: async () => [createFileRecord()],
      listTransactions: async () => [createTransactionRecord()],
      listUsersWithStaticAssets: async () => [createUserRecord()],
      readLegacyStoredFile: async () => Buffer.from("legacy"),
      putCanonicalObject: async (input) => {
        writes.push(input)
      },
      updateFilePath: async (fileId, nextPath, nextFilename) => {
        fileUpdates.push({ fileId, nextPath, nextFilename })
      },
      updateUserAsset: async (userId, field, nextUrl) => {
        userUpdates.push({ userId, field, nextUrl })
      },
    }
  )

  assert.equal(result.dryRun, true)
  assert.equal(result.processedFiles, 1)
  assert.equal(result.processedStaticAssets, 2)
  assert.equal(result.updatedFiles, 0)
  assert.equal(result.updatedStaticAssets, 0)
  assert.equal(result.errors.length, 0)
  assert.deepEqual(writes, [])
  assert.deepEqual(fileUpdates, [])
  assert.deepEqual(userUpdates, [])
})

test("migrateStorage copia objetos legacy y actualiza referencias en modo apply", async () => {
  const writes = []
  const fileUpdates = []
  const userUpdates = []

  const result = await migrateStorage(
    {
      dryRun: false,
      organizationId: "org_1",
    },
    {
      listFiles: async () => [createFileRecord()],
      listTransactions: async () => [],
      listUsersWithStaticAssets: async () => [
        createUserRecord({
          businessLogo: null,
        }),
      ],
      readLegacyStoredFile: async (item) =>
        Buffer.from(item.storedPath === "avatar.webp" ? "avatar" : "legacy-file"),
      putCanonicalObject: async (input) => {
        writes.push(input)
      },
      updateFilePath: async (fileId, nextPath, nextFilename) => {
        fileUpdates.push({ fileId, nextPath, nextFilename })
      },
      updateUserAsset: async (userId, field, nextUrl) => {
        userUpdates.push({ userId, field, nextUrl })
      },
    }
  )

  assert.equal(result.dryRun, false)
  assert.equal(result.updatedFiles, 1)
  assert.equal(result.updatedStaticAssets, 1)
  assert.equal(result.errors.length, 0)
  assert.deepEqual(writes, [
    {
      ownerOrganizationId: "org_1",
      objectKey: "organizations/org_1/uploads/unsorted/file_1.pdf",
      kind: "unsorted",
      contentType: null,
      body: Buffer.from("legacy-file"),
    },
    {
      ownerOrganizationId: "org_1",
      objectKey: "organizations/org_1/static/avatar/user_1.webp",
      kind: "static",
      contentType: null,
      body: Buffer.from("avatar"),
    },
  ])
  assert.deepEqual(fileUpdates, [
    {
      fileId: "file_1",
      nextPath: "organizations/org_1/uploads/unsorted/file_1.pdf",
      nextFilename: "ticket.pdf",
    },
  ])
  assert.deepEqual(userUpdates, [
    {
      userId: "user_1",
      field: "avatar",
      nextUrl: "/files/static/organizations/org_1/static/avatar/user_1.webp",
    },
  ])
})
