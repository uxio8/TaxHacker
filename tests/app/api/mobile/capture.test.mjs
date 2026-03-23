import assert from "node:assert/strict"
import test from "node:test"

import { createMobileCaptureRoute } from "../../../../app/api/mobile/capture/create-route.ts"

test("POST /api/mobile/capture responde 401 sin usuario autenticado", async () => {
  const handler = createMobileCaptureRoute({
    getCurrentUser: async () => null,
    captureMobileFiles: async () => {
      throw new Error("no debe ejecutarse")
    },
  })

  const request = new Request("http://localhost/api/mobile/capture", {
    method: "POST",
    body: new FormData(),
  })
  const response = await handler(request)

  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: "Unauthorized" })
})

test("POST /api/mobile/capture delega en captureMobileFiles y devuelve items serializados", async () => {
  let receivedUser = null
  const handler = createMobileCaptureRoute({
    getCurrentUser: async () => ({
      id: "user-1",
      organizationId: "org-1",
      storageLimit: 1000,
      storageUsed: 0,
    }),
    requireCurrentTenantWriteAccess: async () => {},
    captureMobileFiles: async ({ user }) => {
      receivedUser = user

      return {
      ok: true,
      items: [
        {
          fileId: "file-1",
          state: "analyzing",
          reasonCode: null,
          confidence: null,
          inboxUrl: "/capture/inbox",
          reviewUrl: null,
        },
      ],
    }
    },
  })

  const formData = new FormData()
  formData.append("files", new File(["pdf"], "factura.pdf", { type: "application/pdf" }))

  const response = await handler(
    new Request("http://localhost/api/mobile/capture", {
      method: "POST",
      body: formData,
    })
  )

  assert.equal(response.status, 201)
  assert.deepEqual(receivedUser, {
    id: "user-1",
    organizationId: "org-1",
    storageLimit: 1000,
    storageUsed: 0,
  })
  assert.deepEqual(await response.json(), {
    items: [
      {
        fileId: "file-1",
        state: "analyzing",
        reasonCode: null,
        confidence: null,
        inboxUrl: "/capture/inbox",
        reviewUrl: null,
      },
    ],
  })
})

test("POST /api/mobile/capture responde 403 si la sesión activa de soporte es de solo lectura", async () => {
  const handler = createMobileCaptureRoute({
    getCurrentUser: async () => ({
      id: "user-1",
      organizationId: "org-1",
    }),
    requireCurrentTenantWriteAccess: async () => {
      throw new Error("La sesión de soporte activa es de solo lectura")
    },
    captureMobileFiles: async () => {
      throw new Error("no debe ejecutarse")
    },
  })

  const response = await handler(
    new Request("http://localhost/api/mobile/capture", {
      method: "POST",
      body: new FormData(),
    })
  )

  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), {
    error: "La sesión de soporte activa es de solo lectura",
  })
})
