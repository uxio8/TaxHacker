import assert from "node:assert/strict"
import test from "node:test"

import { uploadFiles } from "../../models/uploads.ts"

function createUser(overrides = {}) {
  return {
    id: "user-1",
    organizationId: "org-1",
    email: "user@example.com",
    storageLimit: 10_000,
    storageUsed: 100,
    accessStatus: "enabled",
    membershipExpiresAt: null,
    ...overrides,
  }
}

function createUploadFile(name = "factura.pdf", type = "application/pdf") {
  return new File(["pdf-content"], name, {
    type,
    lastModified: 1_710_000_000_000,
  })
}

test("uploadFiles guarda en unsorted cuando no hay transactionId", async () => {
  const writes = []
  const createdRecords = []
  const updatedStorage = []

  const result = await uploadFiles(
    {
      user: createUser(),
      files: [createUploadFile()],
    },
    {
      createId: () => "file-1",
      isSubscriptionExpired: () => false,
      hasAvailableStorage: () => true,
      getUserUploadsDirectory: () => "/uploads/user@example.com",
      writeStoredFile: async ({ storedPath, buffer }) => {
        writes.push({ storedPath, size: buffer.length })
      },
      createFileRecord: async (_userId, data) => {
        createdRecords.push(data)
        return {
          id: data.id,
          filename: data.filename,
          path: data.path,
          mimetype: data.mimetype,
          isReviewed: data.isReviewed,
          metadata: data.metadata,
        }
      },
      calculateStorageUsed: async () => 4321,
      updateUserStorage: async (user, storageUsed) => {
        updatedStorage.push({ userId: user.id, organizationId: user.organizationId, storageUsed })
      },
    }
  )

  assert.equal(result.success, true)
  assert.equal(result.status, 201)
  assert.equal(result.error, null)
  assert.equal(result.destination, "unsorted")
  assert.equal(result.transactionId, null)
  assert.deepEqual(result.files, [
    {
      id: "file-1",
      filename: "factura.pdf",
      path: "organizations/org-1/uploads/unsorted/file-1.pdf",
      mimetype: "application/pdf",
      isReviewed: false,
      metadata: {
        size: 11,
        lastModified: 1_710_000_000_000,
      },
    },
  ])
  assert.deepEqual(writes, [
    {
      storedPath: "organizations/org-1/uploads/unsorted/file-1.pdf",
      size: 11,
    },
  ])
  assert.deepEqual(createdRecords, [
    {
      id: "file-1",
      organizationId: "org-1",
      filename: "factura.pdf",
      path: "organizations/org-1/uploads/unsorted/file-1.pdf",
      mimetype: "application/pdf",
      isReviewed: false,
      metadata: {
        size: 11,
        lastModified: 1_710_000_000_000,
      },
    },
  ])
  assert.deepEqual(updatedStorage, [{ userId: "user-1", organizationId: "org-1", storageUsed: 4321 }])
})

test("uploadFiles vincula los archivos a una transaccion existente", async () => {
  const updatedTransactionFiles = []

  const result = await uploadFiles(
    {
      user: createUser(),
      transactionId: "tx-1",
      files: [createUploadFile("ticket.jpg", "image/jpeg")],
    },
    {
      createId: () => "file-2",
      isSubscriptionExpired: () => false,
      hasAvailableStorage: () => true,
      getTransactionById: async () => ({
        id: "tx-1",
        files: ["file-existing"],
        issuedAt: new Date("2026-02-10T00:00:00.000Z"),
      }),
      getUserUploadsDirectory: () => "/uploads/user@example.com",
      writeStoredFile: async () => {},
      createFileRecord: async (_userId, data) => ({
        id: data.id,
        filename: data.filename,
        path: data.path,
        mimetype: data.mimetype,
        isReviewed: data.isReviewed,
        metadata: data.metadata,
      }),
      updateTransactionFiles: async (transactionId, organizationId, fileIds) => {
        updatedTransactionFiles.push({ transactionId, organizationId, fileIds })
      },
      calculateStorageUsed: async () => 2048,
      updateUserStorage: async () => {},
    }
  )

  assert.equal(result.success, true)
  assert.equal(result.destination, "transaction")
  assert.equal(result.transactionId, "tx-1")
  assert.deepEqual(result.files, [
    {
      id: "file-2",
      filename: "(10-02-26).jpg",
      path: "organizations/org-1/uploads/transactions/file-2/2026/02/(10-02-26).jpg",
      mimetype: "image/jpeg",
      isReviewed: true,
      metadata: {
        size: 11,
        lastModified: 1_710_000_000_000,
      },
    },
  ])
  assert.deepEqual(updatedTransactionFiles, [
    {
      transactionId: "tx-1",
      organizationId: "org-1",
      fileIds: ["file-existing", "file-2"],
    },
  ])
})

test("uploadFiles devuelve 400 cuando no se reciben archivos", async () => {
  const result = await uploadFiles(
    {
      user: createUser(),
      files: [],
    },
    {
      isSubscriptionExpired: () => false,
      hasAvailableStorage: () => true,
    }
  )

  assert.deepEqual(result, {
    success: false,
    status: 400,
    error: "No se han recibido archivos",
  })
})

test("uploadFiles devuelve 404 si la transaccion no existe", async () => {
  const result = await uploadFiles(
    {
      user: createUser(),
      transactionId: "tx-missing",
      files: [createUploadFile()],
    },
    {
      isSubscriptionExpired: () => false,
      hasAvailableStorage: () => true,
      getTransactionById: async () => null,
    }
  )

  assert.deepEqual(result, {
    success: false,
    status: 404,
    error: "No se ha encontrado la transaccion",
  })
})

test("uploadFiles devuelve 507 si no hay almacenamiento suficiente", async () => {
  const result = await uploadFiles(
    {
      user: createUser(),
      files: [createUploadFile()],
    },
    {
      isSubscriptionExpired: () => false,
      hasAvailableStorage: () => false,
    }
  )

  assert.deepEqual(result, {
    success: false,
    status: 507,
    error: "No hay almacenamiento suficiente para subir archivos",
  })
})

test("uploadFiles devuelve 403 si la suscripcion ha caducado", async () => {
  const result = await uploadFiles(
    {
      user: createUser(),
      files: [createUploadFile()],
    },
    {
      isSubscriptionExpired: () => true,
      hasAvailableStorage: () => true,
    }
  )

  assert.deepEqual(result, {
    success: false,
    status: 403,
    error: "Tu suscripcion ha caducado. Amplia el plan o compra una nueva suscripcion.",
  })
})

test("uploadFiles devuelve 403 si el acceso de la organización está restringido aunque no haya fecha legacy", async () => {
  const result = await uploadFiles(
    {
      user: createUser({
        membershipExpiresAt: null,
        accessStatus: "restricted",
      }),
      files: [createUploadFile()],
    },
    {
      hasAvailableStorage: () => true,
    }
  )

  assert.deepEqual(result, {
    success: false,
    status: 403,
    error: "Tu suscripcion ha caducado. Amplia el plan o compra una nueva suscripcion.",
  })
})

test("uploadFiles revierte los binarios escritos si falla la persistencia posterior", async () => {
  const deletedBinaryFiles = []
  const deletedFileRecords = []

  const result = await uploadFiles(
    {
      user: createUser(),
      files: [createUploadFile()],
    },
    {
      createId: () => "file-rollback",
      isSubscriptionExpired: () => false,
      hasAvailableStorage: () => true,
      getUserUploadsDirectory: () => "/uploads/user@example.com",
      writeStoredFile: async () => {},
      createFileRecord: async () => {
        throw new Error("db failed")
      },
      deleteStoredFile: async ({ storedPath }) => {
        deletedBinaryFiles.push(storedPath)
        return true
      },
      deleteFileRecord: async (fileId, userId) => {
        deletedFileRecords.push({ fileId, userId })
      },
      calculateStorageUsed: async () => 0,
      updateUserStorage: async () => {
        throw new Error("no debe ejecutarse")
      },
    }
  )

  assert.deepEqual(result, {
    success: false,
    status: 500,
    error: "No se ha podido subir el archivo",
  })
  assert.deepEqual(deletedBinaryFiles, [
    "organizations/org-1/uploads/unsorted/file-rollback.pdf",
  ])
  assert.deepEqual(deletedFileRecords, [])
})
