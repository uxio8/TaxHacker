import assert from "node:assert/strict"
import test from "node:test"

import { createStaticFileRoute } from "../../../app/(app)/files/static/[...filename]/create-route.ts"

test("GET /files/static sirve claves canónicas del storage de la organización", async () => {
  const reads = []
  const handler = createStaticFileRoute({
    getCurrentUser: async () => ({ id: "user-1", email: "user@example.com" }),
    requireCurrentOrganizationId: async () => "org-1",
    getUserUploadsDirectory: () => "/uploads/user@example.com",
    storedPathExists: async ({ storedPath }) => storedPath === "organizations/org-1/static/avatar/user-1.webp",
    readStoredFileBuffer: async (input) => {
      reads.push(input)
      return Buffer.from("avatar-content")
    },
    fileExists: async () => false,
    readFile: async () => {
      throw new Error("no debe ejecutarse")
    },
  })

  const response = await handler(
    new Request("http://localhost/files/static/organizations/org-1/static/avatar/user-1.webp"),
    {
      params: Promise.resolve({
        filename: ["organizations", "org-1", "static", "avatar", "user-1.webp"],
      }),
    }
  )

  assert.equal(response.status, 200)
  assert.equal(await response.text(), "avatar-content")
  assert.equal(response.headers.get("Content-Type"), "image/webp")
  assert.deepEqual(reads, [
    {
      ownerOrganizationId: "org-1",
      ownerUploadsDirectory: "/uploads/user@example.com",
      storedPath: "organizations/org-1/static/avatar/user-1.webp",
    },
  ])
})

test("GET /files/static mantiene compatibilidad con URLs legacy por basename", async () => {
  const readPaths = []

  const handler = createStaticFileRoute({
    getCurrentUser: async () => ({ id: "user-1", email: "user@example.com" }),
    requireCurrentOrganizationId: async () => "org-1",
    getUserUploadsDirectory: () => "/uploads/user@example.com",
    getStaticDirectory: () => "/uploads/user@example.com/static",
    storedPathExists: async () => false,
    readStoredFileBuffer: async () => {
      throw new Error("no debe ejecutarse")
    },
    fileExists: async (filePath) => filePath === "/uploads/user@example.com/static/avatar.webp",
    readFile: async (filePath) => {
      readPaths.push(filePath)
      return Buffer.from("legacy-avatar")
    },
  })

  const response = await handler(new Request("http://localhost/files/static/avatar.webp"), {
    params: Promise.resolve({
      filename: ["avatar.webp"],
    }),
  })

  assert.equal(response.status, 200)
  assert.equal(await response.text(), "legacy-avatar")
  assert.deepEqual(readPaths, ["/uploads/user@example.com/static/avatar.webp"])
  assert.equal(response.headers.get("Content-Type"), "image/webp")
})

test("GET /files/static rechaza claves canónicas de otra organización", async () => {
  let storageTouched = false

  const handler = createStaticFileRoute({
    getCurrentUser: async () => ({ id: "user-1", email: "user@example.com" }),
    requireCurrentOrganizationId: async () => "org-1",
    getUserUploadsDirectory: () => "/uploads/user@example.com",
    storedPathExists: async () => {
      storageTouched = true
      return true
    },
    readStoredFileBuffer: async () => {
      storageTouched = true
      return Buffer.from("forbidden")
    },
    fileExists: async () => false,
    readFile: async () => {
      throw new Error("no debe ejecutarse")
    },
  })

  const response = await handler(
    new Request("http://localhost/files/static/organizations/org-2/static/avatar/user-2.webp"),
    {
      params: Promise.resolve({
        filename: ["organizations", "org-2", "static", "avatar", "user-2.webp"],
      }),
    }
  )

  assert.equal(response.status, 404)
  assert.equal(storageTouched, false)
})
