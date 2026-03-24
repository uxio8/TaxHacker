import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import path from "node:path"
import { buildUploadFormData, uploadFilesWithHttp } from "../../lib/upload-flow.ts"

const uploadButtonPath = path.resolve(process.cwd(), "components/files/upload-button.tsx")
const dashboardDropZonePath = path.resolve(process.cwd(), "components/dashboard/drop-zone-widget.tsx")
const screenDropAreaPath = path.resolve(process.cwd(), "components/files/screen-drop-area.tsx")
const transactionFilesPath = path.resolve(process.cwd(), "components/transactions/transaction-files.tsx")
const uploadFlowPath = path.resolve(process.cwd(), "lib/upload-flow.ts")
const uploadsRoutePath = path.resolve(process.cwd(), "app/api/uploads/route.ts")
const uploadsCreateRoutePath = path.resolve(process.cwd(), "app/api/uploads/create-route.ts")

function readSource(filePath) {
  return readFileSync(filePath, "utf8")
}

test("buildUploadFormData appends files and optional transactionId for the shared uploads api", () => {
  const invoice = new File(["invoice"], "invoice.pdf", { type: "application/pdf" })
  const receipt = new File(["receipt"], "receipt.jpg", { type: "image/jpeg" })

  const formData = buildUploadFormData({
    files: [invoice, receipt],
    transactionId: "txn-123",
  })

  assert.deepEqual(
    formData.getAll("files").map((file) => file.name),
    ["invoice.pdf", "receipt.jpg"]
  )
  assert.equal(formData.get("transactionId"), "txn-123")
})

test("uploadFilesWithHttp posts multipart data to the shared uploads api", async () => {
  const originalFetch = globalThis.fetch
  const invoice = new File(["invoice"], "invoice.pdf", { type: "application/pdf" })
  let requestUrl = null
  let requestMethod = null
  let requestFormData = null

  globalThis.fetch = async (url, init) => {
    requestUrl = url
    requestMethod = init?.method ?? "GET"
    requestFormData = init?.body

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  }

  try {
    const result = await uploadFilesWithHttp({
      files: [invoice],
      transactionId: "txn-123",
    })

    assert.deepEqual(result, { success: true, error: null })
    assert.equal(requestUrl, "/api/uploads")
    assert.equal(requestMethod, "POST")
    assert.equal(requestFormData.get("transactionId"), "txn-123")
    assert.deepEqual(
      requestFormData.getAll("files").map((file) => file.name),
      ["invoice.pdf"]
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("uploadFilesWithHttp returns the api error message when the request fails", async () => {
  const originalFetch = globalThis.fetch

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ success: false, error: "No se ha podido subir el archivo" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    })

  try {
    const result = await uploadFilesWithHttp({
      files: [new File(["invoice"], "invoice.pdf", { type: "application/pdf" })],
    })

    assert.deepEqual(result, {
      success: false,
      error: "No se ha podido subir el archivo",
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("upload widgets do not reuse the same hardcoded file input id", () => {
  for (const filePath of [uploadButtonPath, dashboardDropZonePath]) {
    const source = readSource(filePath)
    assert.ok(!source.includes('id="fileInput"'), `${path.basename(filePath)} still hardcodes id="fileInput"`)
  }
})

test("all upload widgets handle thrown upload errors explicitly", () => {
  for (const filePath of [uploadButtonPath, dashboardDropZonePath, screenDropAreaPath, transactionFilesPath]) {
    const source = readSource(filePath)
    assert.ok(source.includes("catch (error)"), `${path.basename(filePath)} does not catch upload errors`)
  }
})

test("upload widgets use the shared http helper instead of importing server actions directly", () => {
  for (const filePath of [uploadButtonPath, dashboardDropZonePath, screenDropAreaPath, transactionFilesPath]) {
    const source = readSource(filePath)
    assert.ok(source.includes("uploadFilesWithHttp"), `${path.basename(filePath)} does not use uploadFilesWithHttp`)
    assert.ok(!source.includes("uploadFilesAction"), `${path.basename(filePath)} still imports uploadFilesAction`)
    assert.ok(
      !source.includes("uploadTransactionFilesAction"),
      `${path.basename(filePath)} still imports uploadTransactionFilesAction`
    )
  }
})

test("the shared upload flow uses the common uploads api endpoint", () => {
  const source = readSource(uploadFlowPath)
  assert.ok(
    source.includes('fetch("/api/uploads"') || source.includes("fetch('/api/uploads'"),
    "upload-flow.ts does not call /api/uploads"
  )
})

test("the uploads api route exists and forwards the optional transactionId contract", () => {
  const routeSource = readSource(uploadsRoutePath)
  const createRouteSource = readSource(uploadsCreateRoutePath)

  assert.ok(routeSource.includes("createUploadsRoute"), "route.ts does not delegate to createUploadsRoute")
  assert.ok(createRouteSource.includes("formData"), "create-route.ts does not read multipart form data")
  assert.ok(createRouteSource.includes("transactionId"), "create-route.ts does not handle transactionId")
  assert.ok(
    createRouteSource.includes("NextResponse.json") || createRouteSource.includes("Response.json"),
    "create-route.ts does not return json"
  )
})

test("screen drop errors are rendered as dismissible non-blocking notices", () => {
  const source = readSource(screenDropAreaPath)
  assert.ok(source.includes("pointer-events-none"), "screen-drop-area still blocks the full screen on errors")
  assert.ok(source.includes("dismissUploadError"), "screen-drop-area does not expose a dismiss handler")
})
