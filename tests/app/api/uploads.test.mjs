import assert from "node:assert/strict"
import test from "node:test"

import { createUploadsRoute } from "../../../app/api/uploads/create-route.ts"

function createUser() {
  return {
    id: "user-1",
    organizationId: "org-1",
    email: "user@example.com",
    storageLimit: 10_000,
    storageUsed: 100,
  }
}

test("POST /api/uploads responde 401 sin sesion", async () => {
  const handler = createUploadsRoute({
    getSession: async () => null,
    getUserById: async () => {
      throw new Error("no debe ejecutarse")
    },
    uploadFiles: async () => {
      throw new Error("no debe ejecutarse")
    },
  })

  const response = await handler(new Request("http://localhost/api/uploads", { method: "POST", body: new FormData() }))

  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Unauthorized",
  })
})

test("POST /api/uploads responde 400 si el multipart es invalido", async () => {
  const handler = createUploadsRoute({
    getSession: async () => ({ user: { id: "user-1" } }),
    getUserById: async () => createUser(),
    requireCurrentTenantWriteAccess: async () => {},
    uploadFiles: async () => {
      throw new Error("no debe ejecutarse")
    },
  })

  const response = await handler({
    formData: async () => {
      throw new Error("bad form data")
    },
  })

  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), {
    success: false,
    error: "Invalid multipart/form-data",
  })
})

test("POST /api/uploads responde 403 si la sesión de soporte es de solo lectura", async () => {
  const handler = createUploadsRoute({
    getSession: async () => ({ user: { id: "user-1" } }),
    getUserById: async () => createUser(),
    requireCurrentTenantWriteAccess: async () => {
      throw new Error("La sesión de soporte activa es de solo lectura")
    },
    uploadFiles: async () => {
      throw new Error("no debe ejecutarse")
    },
  })

  const response = await handler(new Request("http://localhost/api/uploads", { method: "POST", body: new FormData() }))

  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), {
    success: false,
    error: "La sesión de soporte activa es de solo lectura",
  })
})

test("POST /api/uploads delega en uploadFiles y revalida unsorted", async () => {
  const revalidatedPaths = []
  const receivedInputs = []

  const handler = createUploadsRoute({
    getSession: async () => ({ user: { id: "user-1" } }),
    getUserById: async () => createUser(),
    requireCurrentTenantWriteAccess: async () => {},
    uploadFiles: async (input) => {
      receivedInputs.push(input)
      return {
        success: true,
        status: 201,
        error: null,
        destination: "unsorted",
        transactionId: null,
        files: [
          {
            id: "file-1",
            filename: "factura.pdf",
            path: "unsorted/file-1.pdf",
            mimetype: "application/pdf",
            isReviewed: false,
            metadata: {
              size: 11,
              lastModified: 1_710_000_000_000,
            },
          },
        ],
      }
    },
    revalidatePath: async (pathname) => {
      revalidatedPaths.push(pathname)
    },
  })

  const formData = new FormData()
  formData.append("files", new File(["pdf-content"], "factura.pdf", { type: "application/pdf" }))

  const response = await handler(
    new Request("http://localhost/api/uploads", {
      method: "POST",
      body: formData,
    })
  )

  assert.equal(response.status, 201)
  assert.equal(receivedInputs.length, 1)
  assert.equal(receivedInputs[0].transactionId, undefined)
  assert.equal(receivedInputs[0].files.length, 1)
  assert.deepEqual(await response.json(), {
    success: true,
    error: null,
    destination: "unsorted",
    transactionId: null,
    files: [
      {
        id: "file-1",
        filename: "factura.pdf",
        path: "unsorted/file-1.pdf",
        mimetype: "application/pdf",
        isReviewed: false,
        metadata: {
          size: 11,
          lastModified: 1_710_000_000_000,
        },
      },
    ],
  })
  assert.deepEqual(revalidatedPaths, ["/unsorted"])
})

test("POST /api/uploads revalida la pagina de transaccion cuando la subida va asociada", async () => {
  const revalidatedPaths = []

  const handler = createUploadsRoute({
    getSession: async () => ({ user: { id: "user-1" } }),
    getUserById: async () => createUser(),
    requireCurrentTenantWriteAccess: async () => {},
    uploadFiles: async () => ({
      success: true,
      status: 201,
      error: null,
      destination: "transaction",
      transactionId: "tx-1",
      files: [],
    }),
    revalidatePath: async (pathname) => {
      revalidatedPaths.push(pathname)
    },
  })

  const formData = new FormData()
  formData.append("transactionId", "tx-1")
  formData.append("files", new File(["pdf-content"], "factura.pdf", { type: "application/pdf" }))

  const response = await handler(
    new Request("http://localhost/api/uploads", {
      method: "POST",
      body: formData,
    })
  )

  assert.equal(response.status, 201)
  assert.deepEqual(revalidatedPaths, ["/transactions/tx-1"])
})

test("POST /api/uploads propaga errores controlados del modelo", async () => {
  const handler = createUploadsRoute({
    getSession: async () => ({ user: { id: "user-1" } }),
    getUserById: async () => createUser(),
    requireCurrentTenantWriteAccess: async () => {},
    uploadFiles: async () => ({
      success: false,
      status: 404,
      error: "No se ha encontrado la transaccion",
    }),
    revalidatePath: async () => {
      throw new Error("no debe ejecutarse")
    },
  })

  const formData = new FormData()
  formData.append("transactionId", "tx-missing")
  formData.append("files", new File(["pdf-content"], "factura.pdf", { type: "application/pdf" }))

  const response = await handler(
    new Request("http://localhost/api/uploads", {
      method: "POST",
      body: formData,
    })
  )

  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), {
    success: false,
    error: "No se ha encontrado la transaccion",
  })
})
