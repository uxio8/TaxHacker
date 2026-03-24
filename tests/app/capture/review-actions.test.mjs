import assert from "node:assert/strict"
import test from "node:test"

import { createMobileReviewActions } from "../../../app/(app)/capture/review/[fileId]/review-actions-core.ts"
import { transactionFormSchema } from "../../../forms/transactions.ts"
import { buildReviewedFileUpdate } from "../../../lib/mobile-triage.ts"
import { createMobileInboxResponse, MOBILE_ITEM_STATE } from "../../../models/mobile/inbox.ts"
import { MOBILE_REASON_CODE } from "../../../models/mobile/types.ts"

function createFile(overrides = {}) {
  return {
    id: "file-1",
    metadata: {
      mobileTriage: {
        source: "mobile_capture",
        disposition: "pending",
        lastMobileActionAt: "2026-03-22T10:00:00.000Z",
      },
    },
    cachedParseResult: {
      merchant: "Proveedor demo",
    },
    isReviewed: false,
    ...overrides,
  }
}

function createDependencies(overrides = {}) {
  const calls = {
    updateFile: [],
    saveFileAsTransactionAction: [],
    startAnalysisJobAction: [],
    revalidatePath: [],
  }

  return {
    calls,
    deps: {
      now: () => "2026-03-22T10:30:00.000Z",
      getCurrentUser: async () => ({ id: "user-1" }),
      getCurrentOrganizationId: async () => "org-1",
      getFileById: async () => createFile(),
      updateFile: async (fileId, organizationId, data) => {
        calls.updateFile.push({ fileId, organizationId, data })
      },
      getSettings: async () => ({
        default_currency: "EUR",
        default_category: "general",
        default_type: "expense",
        default_project: "",
      }),
      getFields: async () => [],
      getCategories: async () => [],
      getProjects: async () => [],
      saveFileAsTransactionAction: async (_prevState, formData) => {
        calls.saveFileAsTransactionAction.push(formData)
        return { success: true }
      },
      startAnalysisJobAction: async (file) => {
        calls.startAnalysisJobAction.push(file.id)
        return { success: true, data: { jobId: "job-1", status: "queued" } }
      },
      revalidatePath: (pathname) => {
        calls.revalidatePath.push(pathname)
      },
      ...overrides,
    },
  }
}

test("acceptMobileReviewAction sanea sentinelas serializados antes del boundary de guardado", async () => {
  const cases = [
    {
      label: "invoiceNumber ausente",
      input: {
        invoiceNumber: undefined,
        currencyCode: "EUR",
        categoryCode: "general",
      },
      expected: {
        invoice_number: "",
        currencyCode: "EUR",
        categoryCode: "general",
        name: "Proveedor demo",
      },
    },
    {
      label: "invoiceNumber como string undefined",
      input: {
        invoiceNumber: "undefined",
        currencyCode: "EUR",
        categoryCode: "general",
      },
      expected: {
        invoice_number: "",
        currencyCode: "EUR",
        categoryCode: "general",
        name: "Proveedor demo",
      },
    },
    {
      label: "invoiceNumber como string null",
      input: {
        invoiceNumber: "null",
        currencyCode: "EUR",
        categoryCode: "general",
      },
      expected: {
        invoice_number: "",
        currencyCode: "EUR",
        categoryCode: "general",
        name: "Proveedor demo",
      },
    },
    {
      label: "currencyCode como string undefined",
      input: {
        invoiceNumber: "F-1",
        currencyCode: "undefined",
        categoryCode: "general",
      },
      expected: {
        invoice_number: "F-1",
        currencyCode: "EUR",
        categoryCode: "general",
        name: "F-1",
      },
    },
    {
      label: "categoryCode como string null",
      input: {
        invoiceNumber: "F-1",
        currencyCode: "EUR",
        categoryCode: "null",
      },
      expected: {
        invoice_number: "F-1",
        currencyCode: "EUR",
        categoryCode: "general",
        name: "F-1",
      },
    },
  ]

  for (const testCase of cases) {
    const { deps, calls } = createDependencies()
    const actions = createMobileReviewActions(deps)

    const result = await actions.acceptMobileReviewAction({
      fileId: "file-1",
      merchant: "Proveedor demo",
      issuedAt: "2026-03-22",
      total: "123.45",
      currencyCode: testCase.input.currencyCode,
      invoiceNumber: testCase.input.invoiceNumber,
      categoryCode: testCase.input.categoryCode,
    })

    assert.deepEqual(result, { success: true }, testCase.label)
    assert.equal(calls.updateFile.length, 1, testCase.label)
    assert.equal(
      calls.updateFile[0]?.data.cachedParseResult.invoice_number,
      testCase.expected.invoice_number,
      `${testCase.label}: cachedParseResult.invoice_number`
    )
    assert.equal(
      calls.updateFile[0]?.data.cachedParseResult.currencyCode,
      testCase.expected.currencyCode,
      `${testCase.label}: cachedParseResult.currencyCode`
    )
    assert.equal(
      calls.updateFile[0]?.data.cachedParseResult.categoryCode,
      testCase.expected.categoryCode,
      `${testCase.label}: cachedParseResult.categoryCode`
    )
    assert.equal(calls.saveFileAsTransactionAction.length, 1, testCase.label)
    const saveFormData = calls.saveFileAsTransactionAction[0]
    assert.equal(
      saveFormData?.get("invoice_number"),
      testCase.expected.invoice_number,
      `${testCase.label}: formData.invoice_number`
    )
    assert.equal(
      saveFormData?.get("currencyCode"),
      testCase.expected.currencyCode,
      `${testCase.label}: formData.currencyCode`
    )
    assert.equal(
      saveFormData?.get("categoryCode"),
      testCase.expected.categoryCode,
      `${testCase.label}: formData.categoryCode`
    )
    assert.equal(saveFormData?.get("name"), testCase.expected.name, `${testCase.label}: formData.name`)

    const validatedForm = transactionFormSchema.safeParse(Object.fromEntries(saveFormData.entries()))

    assert.equal(validatedForm.success, true, `${testCase.label}: safeParse`)
    assert.equal(
      validatedForm.data.invoice_number,
      testCase.expected.invoice_number,
      `${testCase.label}: parsed.invoice_number`
    )
    assert.equal(
      validatedForm.data.currencyCode,
      testCase.expected.currencyCode,
      `${testCase.label}: parsed.currencyCode`
    )
    assert.equal(
      validatedForm.data.categoryCode,
      testCase.expected.categoryCode,
      `${testCase.label}: parsed.categoryCode`
    )
    assert.equal(validatedForm.data.name, testCase.expected.name, `${testCase.label}: parsed.name`)
    assert.equal(validatedForm.data.total, 12345, `${testCase.label}: parsed.total`)
  }
})

test("acceptMobileReviewAction bloquea la doble aceptacion sobre un fichero ya revisado", async () => {
  const { deps, calls } = createDependencies({
    getFileById: async () => createFile({ isReviewed: true }),
  })
  const actions = createMobileReviewActions(deps)

  const result = await actions.acceptMobileReviewAction({
    fileId: "file-1",
    merchant: "Proveedor demo",
    issuedAt: "2026-03-22",
    total: "123.45",
    currencyCode: "EUR",
    invoiceNumber: "F-1",
    categoryCode: "general",
  })

  assert.deepEqual(result, {
    success: false,
    error: "Este documento ya no esta disponible para revision movil.",
  })
  assert.deepEqual(calls.updateFile, [])
  assert.deepEqual(calls.saveFileAsTransactionAction, [])
})

test("acceptMobileReviewAction bloquea una URL vieja fuera del canal movil", async () => {
  const { deps, calls } = createDependencies({
    getFileById: async () =>
      createFile({
        metadata: {},
      }),
  })
  const actions = createMobileReviewActions(deps)

  const result = await actions.acceptMobileReviewAction({
    fileId: "file-1",
    merchant: "Proveedor demo",
    issuedAt: "2026-03-22",
    total: "123.45",
    currencyCode: "EUR",
    invoiceNumber: "F-1",
    categoryCode: "general",
  })

  assert.deepEqual(result, {
    success: false,
    error: "Este documento ya no esta disponible para revision movil.",
  })
  assert.deepEqual(calls.updateFile, [])
  assert.deepEqual(calls.saveFileAsTransactionAction, [])
})

test("acceptMobileReviewAction bloquea URLs ya diferidas o con analysis_failed persistido", async () => {
  const cases = [
    {
      label: "diferida",
      metadata: {
        mobileTriage: {
          source: "mobile_capture",
          disposition: "deferred",
          lastMobileActionAt: "2026-03-22T10:00:00.000Z",
        },
      },
    },
    {
      label: "analysis_failed persistido",
      metadata: {
        mobileTriage: {
          source: "mobile_capture",
          disposition: "deferred",
          reasonCode: MOBILE_REASON_CODE.ANALYSIS_FAILED,
          lastMobileActionAt: "2026-03-22T10:05:00.000Z",
        },
      },
    },
  ]

  for (const testCase of cases) {
    const { deps, calls } = createDependencies({
      getFileById: async () =>
        createFile({
          metadata: testCase.metadata,
        }),
    })
    const actions = createMobileReviewActions(deps)

    const result = await actions.acceptMobileReviewAction({
      fileId: "file-1",
      merchant: "Proveedor demo",
      issuedAt: "2026-03-22",
      total: "123.45",
      currencyCode: "EUR",
      invoiceNumber: "F-1",
      categoryCode: "general",
    })

    assert.deepEqual(
      result,
      {
        success: false,
        error: "Este documento ya no esta disponible para revision movil.",
      },
      testCase.label
    )
    assert.deepEqual(calls.updateFile, [], testCase.label)
    assert.deepEqual(calls.saveFileAsTransactionAction, [], testCase.label)
  }
})

test("buildReviewedFileUpdate deja el fichero revisado con metadata terminal limpia", () => {
  const result = buildReviewedFileUpdate({
    filename: "factura-final.pdf",
    path: "processed/factura-final.pdf",
    metadata: {
      documentType: "receipt",
      mobileTriage: {
        source: "mobile_capture",
        disposition: "pending",
        lastMobileActionAt: "2026-03-22T10:00:00.000Z",
      },
    },
  })

  assert.deepEqual(result, {
    filename: "factura-final.pdf",
    path: "processed/factura-final.pdf",
    isReviewed: true,
    metadata: {
      documentType: "receipt",
    },
  })
})

test("acceptMobileReviewAction delega el estado terminal al guardado de transaccion", async () => {
  const file = createFile({
    metadata: {
      documentType: "receipt",
      mobileTriage: {
        source: "mobile_capture",
        disposition: "pending",
        lastMobileActionAt: "2026-03-22T10:00:00.000Z",
      },
    },
  })
  const { deps, calls } = createDependencies({
    getFileById: async () => file,
  })
  const actions = createMobileReviewActions(deps)

  const result = await actions.acceptMobileReviewAction({
    fileId: "file-1",
    merchant: "Proveedor demo",
    issuedAt: "2026-03-22",
    total: "123.45",
    currencyCode: "EUR",
    invoiceNumber: "F-1",
    categoryCode: "general",
  })

  assert.deepEqual(result, { success: true })
  assert.equal(calls.saveFileAsTransactionAction.length, 1)
  assert.equal(calls.updateFile.length, 1)
  assert.equal(calls.updateFile[0]?.data.isReviewed, undefined)
  assert.equal(calls.updateFile[0]?.data.metadata.mobileTriage.disposition, "pending")
})

test("retryMobileReviewAction no persiste metadata si el reencolado falla", async () => {
  const { deps, calls } = createDependencies({
    startAnalysisJobAction: async () => ({
      success: false,
      error: "worker caido",
    }),
  })
  const actions = createMobileReviewActions(deps)

  const result = await actions.retryMobileReviewAction("file-1")

  assert.deepEqual(result, {
    success: false,
    error: "worker caido",
  })
  assert.equal(calls.updateFile.length, 2)
  assert.equal(calls.updateFile[0]?.data.metadata.mobileTriage.disposition, "pending")
  assert.deepEqual(calls.updateFile[1]?.data, {
    metadata: createFile().metadata,
  })
  assert.deepEqual(calls.revalidatePath, [])
})

test("retryMobileReviewAction restaura metadata si startAnalysisJobAction lanza una excepcion", async () => {
  const { deps, calls } = createDependencies({
    startAnalysisJobAction: async () => {
      throw new Error("fallo inesperado del worker")
    },
  })
  const actions = createMobileReviewActions(deps)

  const result = await actions.retryMobileReviewAction("file-1")

  assert.deepEqual(result, {
    success: false,
    error: "fallo inesperado del worker",
  })
  assert.equal(calls.updateFile.length, 2)
  assert.equal(calls.updateFile[0]?.data.metadata.mobileTriage.disposition, "pending")
  assert.deepEqual(calls.updateFile[1]?.data, {
    metadata: createFile().metadata,
  })
  assert.deepEqual(calls.revalidatePath, [])
})

test("retryMobileReviewAction permite relanzar un diferido automatico y solo marca pending despues del job", async () => {
  const { deps, calls } = createDependencies({
    getFileById: async () =>
      createFile({
        metadata: {
          mobileTriage: {
            source: "mobile_capture",
            disposition: "deferred",
            reasonCode: "worker_unavailable",
            lastMobileActionAt: "2026-03-22T10:00:00.000Z",
          },
        },
      }),
  })
  const actions = createMobileReviewActions(deps)

  const result = await actions.retryMobileReviewAction("file-1")

  assert.deepEqual(result, { success: true })
  assert.deepEqual(calls.startAnalysisJobAction, ["file-1"])
  assert.equal(calls.updateFile.length, 1)
  assert.equal(calls.updateFile[0]?.data.metadata.mobileTriage.disposition, "pending")
  assert.deepEqual(calls.revalidatePath, ["/capture/inbox"])
})

test("retryMobileReviewAction limpia analysis_failed y el inbox deja de renderizar ERROR", async () => {
  const { deps, calls } = createDependencies({
    getFileById: async () =>
      createFile({
        metadata: {
          mobileTriage: {
            source: "mobile_capture",
            disposition: "deferred",
            reasonCode: MOBILE_REASON_CODE.ANALYSIS_FAILED,
            lastMobileActionAt: "2026-03-22T10:00:00.000Z",
          },
        },
      }),
  })
  const actions = createMobileReviewActions(deps)

  const result = await actions.retryMobileReviewAction("file-1")

  assert.deepEqual(result, { success: true })
  assert.equal(calls.updateFile.length, 1)
  assert.equal(calls.updateFile[0]?.data.metadata.mobileTriage.disposition, "pending")
  assert.equal(calls.updateFile[0]?.data.metadata.mobileTriage.reasonCode, undefined)

  const response = await createMobileInboxResponse(
    {
      user: { id: "user-1", storageLimit: 1000, storageUsed: 100 },
      files: [
        createFile({
          metadata: calls.updateFile[0]?.data.metadata,
        }),
      ],
      jobsByFileId: new Map(),
    },
    {
      getSystemStatus: async () => ({
        llmConfigured: true,
        workerAvailable: true,
        storageAvailable: true,
        blockingReasonCode: null,
      }),
    }
  )

  assert.equal(response.items[0]?.state, MOBILE_ITEM_STATE.READY_FOR_REVIEW)
  assert.notEqual(response.items[0]?.reasonCode, MOBILE_REASON_CODE.ANALYSIS_FAILED)
})
