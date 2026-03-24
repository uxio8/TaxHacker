import assert from "node:assert/strict"
import test from "node:test"

import config from "../../../lib/config.ts"
import { pdfToImages } from "../../../lib/previews/pdf.ts"

const owner = {
  id: "user-1",
  email: "owner@example.com",
}

test("pdfToImages intenta convertir solo hasta el máximo de páginas configurado", async () => {
  const calls = []

  const result = await pdfToImages(
    owner,
    "org-1",
    "file-1",
    "/tmp/factura.pdf",
    {
      fileExists: async () => false,
      storedPathExists: async () => false,
      assertPdfRuntimeDependencies: async () => {},
      createTempDirectory: async () => "/tmp/previews",
      createConvert: () => ({
        bulk: async (pages, options) => {
          calls.push({ pages, options })

          return pages.map((page) => ({
            path: `/tmp/generated-${page}.webp`,
          }))
        },
      }),
      readFile: async (filePath) => Buffer.from(`image:${filePath}`),
      putStoredFileBuffer: async () => {},
      deleteFile: async () => {},
      removeDirectory: async () => {},
    }
  )

  const expectedPages = Array.from({ length: config.upload.pdfs.maxPages }, (_, index) => index + 1)

  assert.deepEqual(calls, [
    {
      pages: expectedPages,
      options: { responseType: "image" },
    },
  ])
  assert.deepEqual(
    result.pages,
    expectedPages.map((page) => `organizations/org-1/derived/previews/file-1/${page}.webp`)
  )
})

test("pdfToImages recorta y limpia el exceso si el fallback convierte más páginas", async () => {
  const deleted = []

  const result = await pdfToImages(
    owner,
    "org-1",
    "file-2",
    "/tmp/factura.pdf",
    {
      fileExists: async () => false,
      storedPathExists: async () => false,
      assertPdfRuntimeDependencies: async () => {},
      createTempDirectory: async () => "/tmp/previews",
      createConvert: () => ({
        bulk: async (pages) => {
          if (Array.isArray(pages)) {
            throw new Error("simulated short-pdf fallback")
          }

          return Array.from({ length: config.upload.pdfs.maxPages + 2 }, (_, index) => ({
            path: `/tmp/fallback-${index + 1}.webp`,
          }))
        },
      }),
      readFile: async () => Buffer.from("preview"),
      putStoredFileBuffer: async () => {},
      deleteFile: async (filePath) => {
        deleted.push(filePath)
      },
      removeDirectory: async () => {},
    }
  )

  assert.equal(result.pages.length, config.upload.pdfs.maxPages)
  assert.deepEqual(deleted, ["/tmp/fallback-11.webp", "/tmp/fallback-12.webp"])
})
