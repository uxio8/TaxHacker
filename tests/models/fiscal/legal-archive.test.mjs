import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { FISCAL_PERIOD_STATUS_OPEN, buildFiscalPeriodKey, buildFiscalQuarterBounds } from "../../../models/fiscal/periods.ts"
import { buildLegalArchiveManifest, listLegalArchivePeriods } from "../../../models/fiscal/legal-archive.ts"

function loadGoldenQuarter() {
  return JSON.parse(
    readFileSync(new URL("../../fixtures/fiscal/golden-quarter.json", import.meta.url), "utf8")
  )
}

function createFiscalPeriodFromGolden(goldenQuarter) {
  const periodKey = buildFiscalPeriodKey(goldenQuarter.fiscal_year, goldenQuarter.quarter)
  const bounds = buildFiscalQuarterBounds(goldenQuarter.fiscal_year, goldenQuarter.quarter)

  return {
    id: `period_${periodKey.toLowerCase()}`,
    ownerScopeId: "fp_demo",
    fiscalYear: goldenQuarter.fiscal_year,
    quarter: goldenQuarter.quarter,
    periodKey,
    startsOn: bounds.startsOn.toISOString().slice(0, 10),
    endsOn: bounds.endsOn.toISOString().slice(0, 10),
    status: FISCAL_PERIOD_STATUS_OPEN,
    countryCode: "ES",
    currencyCode: "EUR",
    createdAt: "2026-03-21T09:00:00.000Z",
    updatedAt: "2026-03-21T09:00:00.000Z",
  }
}

function getGoldenDocumentById(fiscalDocumentId) {
  const entry = loadGoldenQuarter().documents.find(
    (candidate) => candidate.document.header.fiscal_document_id === fiscalDocumentId
  )

  assert.ok(entry, `No existe el documento ${fiscalDocumentId} en el golden quarter`)
  return {
    header: {
      ...entry.document.header,
    },
    lines: entry.document.lines.map((line) => ({
      ...line,
    })),
  }
}

function createAttachment(overrides = {}) {
  return {
    id: "file_default",
    filename: "document.pdf",
    mediaType: "application/pdf",
    byteSize: 1024,
    createdAt: "2026-03-21T09:00:00.000Z",
    ...overrides,
  }
}

test("buildLegalArchiveManifest genera un manifiesto reproducible y honesto por periodo fiscal", () => {
  const period = createFiscalPeriodFromGolden(loadGoldenQuarter().quarter)
  const documents = [
    getGoldenDocumentById("fd_q1_002"),
    getGoldenDocumentById("fd_q1_007"),
    getGoldenDocumentById("fd_q1_001"),
  ]

  const manifest = buildLegalArchiveManifest(period, documents, {
    tx_q1_002: [
      createAttachment({
        id: "file_rent_xml",
        filename: "b-retencion.xml",
        mediaType: "application/xml",
        byteSize: 2048,
      }),
      createAttachment({
        id: "file_rent_pdf",
        filename: "a-alquiler.pdf",
        byteSize: 4096,
      }),
    ],
    tx_q1_001: [
      createAttachment({
        id: "file_supplies_pdf",
        filename: "factura-papeleria.pdf",
        byteSize: 5120,
      }),
    ],
    tx_extra_999: [
      createAttachment({
        id: "file_extra_pdf",
        filename: "sin-vincular.pdf",
      }),
    ],
  })

  assert.deepEqual(manifest.period, {
    fiscalYear: 2026,
    quarter: 1,
    periodKey: "2026-Q1",
    startsOn: "2026-01-01",
    endsOn: "2026-03-31",
    status: "open",
  })
  assert.deepEqual(manifest.totals, {
    expectedSourceCount: 2,
    availableSourceCount: 2,
    missingSourceCount: 0,
    attachmentCount: 3,
    unexpectedSourceCount: 1,
    unexpectedAttachmentCount: 1,
  })
  assert.deepEqual(
    manifest.sources.map((source) => ({
      sourceTransactionId: source.sourceTransactionId,
      fiscalDocumentId: source.fiscalDocumentId,
      issueDate: source.issueDate,
      attachmentStatus: source.attachmentStatus,
      attachments: source.attachments.map((attachment) => attachment.filename),
    })),
    [
      {
        sourceTransactionId: "tx_q1_001",
        fiscalDocumentId: "fd_q1_001",
        issueDate: "2026-01-15",
        attachmentStatus: "available",
        attachments: ["factura-papeleria.pdf"],
      },
      {
        sourceTransactionId: "tx_q1_002",
        fiscalDocumentId: "fd_q1_002",
        issueDate: "2026-02-01",
        attachmentStatus: "available",
        attachments: ["a-alquiler.pdf", "b-retencion.xml"],
      },
    ]
  )
  assert.equal(
    manifest.sources.some((source) => source.fiscalDocumentId === "fd_q1_007"),
    false
  )
  assert.deepEqual(manifest.unexpectedSources, [
    {
      sourceTransactionId: "tx_extra_999",
      attachmentCount: 1,
      attachments: [
        {
          id: "file_extra_pdf",
          filename: "sin-vincular.pdf",
          mediaType: "application/pdf",
          byteSize: 1024,
          createdAt: "2026-03-21T09:00:00.000Z",
        },
      ],
    },
  ])
})

test("buildLegalArchiveManifest excluye fuentes asignadas explicitamente a otro periodo y conserva sus adjuntos como inesperados", () => {
  const period = createFiscalPeriodFromGolden(loadGoldenQuarter().quarter)
  const reassignedDocument = getGoldenDocumentById("fd_q1_001")

  reassignedDocument.header.vat_period_assignment = {
    ...reassignedDocument.header.vat_period_assignment,
    fiscal_year: 2026,
    quarter: 2,
    period_key: "2026-Q2",
  }

  const manifest = buildLegalArchiveManifest(period, [reassignedDocument], {
    tx_q1_001: [
      createAttachment({
        id: "file_q2_pdf",
        filename: "factura-q2.pdf",
      }),
    ],
  })

  assert.deepEqual(manifest.totals, {
    expectedSourceCount: 0,
    availableSourceCount: 0,
    missingSourceCount: 0,
    attachmentCount: 0,
    unexpectedSourceCount: 1,
    unexpectedAttachmentCount: 1,
  })
  assert.deepEqual(manifest.sources, [])
  assert.deepEqual(manifest.unexpectedSources, [
    {
      sourceTransactionId: "tx_q1_001",
      attachmentCount: 1,
      attachments: [
        {
          id: "file_q2_pdf",
          filename: "factura-q2.pdf",
          mediaType: "application/pdf",
          byteSize: 1024,
          createdAt: "2026-03-21T09:00:00.000Z",
        },
      ],
    },
  ])
})

test("buildLegalArchiveManifest excluye documentos sin asignacion persistida aunque su fecha caiga en el trimestre", () => {
  const period = createFiscalPeriodFromGolden(loadGoldenQuarter().quarter)
  const unassignedDocument = getGoldenDocumentById("fd_q1_001")

  unassignedDocument.header.vat_period_assignment = null
  unassignedDocument.header.withholding_period_assignment = null
  unassignedDocument.header.review_status = "needs_review"
  unassignedDocument.header.review_reasons = ["period_assignment_unclear"]

  const manifest = buildLegalArchiveManifest(period, [unassignedDocument], {
    tx_q1_001: [
      createAttachment({
        id: "file_unassigned_pdf",
        filename: "sin-asignacion.pdf",
      }),
    ],
  })

  assert.deepEqual(manifest.totals, {
    expectedSourceCount: 0,
    availableSourceCount: 0,
    missingSourceCount: 0,
    attachmentCount: 0,
    unexpectedSourceCount: 1,
    unexpectedAttachmentCount: 1,
  })
  assert.deepEqual(manifest.sources, [])
  assert.deepEqual(manifest.unexpectedSources, [
    {
      sourceTransactionId: "tx_q1_001",
      attachmentCount: 1,
      attachments: [
        {
          id: "file_unassigned_pdf",
          filename: "sin-asignacion.pdf",
          mediaType: "application/pdf",
          byteSize: 1024,
          createdAt: "2026-03-21T09:00:00.000Z",
        },
      ],
    },
  ])
})

test("listLegalArchivePeriods lee transacciones y adjuntos por organizationId, no por userId", async () => {
  let capturedTransactionWhere = null
  let capturedFileWhere = null

  const periods = await listLegalArchivePeriods("fp_demo", "org_demo", {
    fiscalPeriod: {
      findMany: async () => [
        {
          id: "period_2026_q1",
          ownerScopeId: "fp_demo",
          fiscalYear: 2026,
          quarter: 1,
          periodKey: "2026-Q1",
          startsOn: new Date("2026-01-01T00:00:00.000Z"),
          endsOn: new Date("2026-03-31T00:00:00.000Z"),
          status: "open",
          countryCode: "ES",
          currencyCode: "EUR",
          createdAt: new Date("2026-03-21T09:00:00.000Z"),
          updatedAt: new Date("2026-03-21T09:00:00.000Z"),
        },
      ],
      findUnique: async () => null,
    },
    transactionFiscal: {
      findMany: async () => [
        {
          id: "fd_1",
          sourceTransactionId: "tx_1",
          documentKind: "received_invoice",
          direction: "inbound",
          invoiceNumber: "2026-001",
          invoiceSeries: null,
          issueDate: new Date("2026-01-15T00:00:00.000Z"),
          operationDate: null,
          paymentDate: null,
          currencyCode: "EUR",
          counterpartyId: null,
          counterpartyRole: "supplier",
          counterpartyName: "Proveedor Demo",
          counterpartyTaxId: null,
          counterpartyCountryCode: "ES",
          companyTaxId: "B12345678",
          reviewStatus: "ready",
          reviewReasons: [],
          vatPeriodAssignment: { period_key: "2026-Q1" },
          withholdingPeriodAssignment: null,
          observedAmountCents: 1000,
          totalNetCents: 1000,
          totalVatCents: 210,
          totalWithholdingCents: 0,
          totalGrossCents: 1210,
          totalPayableCents: 1210,
          sourceConfidence: "high",
          notes: null,
          lines: [],
        },
      ],
    },
    transaction: {
      findMany: async (args) => {
        capturedTransactionWhere = args.where
        return [{ id: "tx_1", files: ["file_1"] }]
      },
    },
    file: {
      findMany: async (args) => {
        capturedFileWhere = args.where
        return [
          {
            id: "file_1",
            filename: "factura.pdf",
            mimetype: "application/pdf",
            metadata: { size: 1024 },
            createdAt: new Date("2026-03-21T09:00:00.000Z"),
          },
        ]
      },
    },
  })

  assert.deepEqual(capturedTransactionWhere, {
    organizationId: "org_demo",
    id: {
      in: ["tx_1"],
    },
  })
  assert.deepEqual(capturedFileWhere, {
    organizationId: "org_demo",
    id: {
      in: ["file_1"],
    },
  })
  assert.equal(periods.length, 1)
  assert.equal(periods[0].manifest.totals.attachmentCount, 1)
})

test("buildLegalArchiveManifest permite partir un mismo documento entre IVA y retencion en trimestres distintos", () => {
  const q1Period = createFiscalPeriodFromGolden(loadGoldenQuarter().quarter)
  const q2Period = createFiscalPeriodFromGolden({ fiscal_year: 2026, quarter: 2 })
  const splitDocument = getGoldenDocumentById("fd_q1_002")

  splitDocument.header.withholding_period_assignment = {
    ...splitDocument.header.withholding_period_assignment,
    fiscal_year: 2026,
    quarter: 2,
    period_key: "2026-Q2",
    basis: "payment_date",
  }

  const attachments = {
    tx_q1_002: [
      createAttachment({
        id: "file_split_pdf",
        filename: "alquiler-split.pdf",
      }),
    ],
  }

  const q1Manifest = buildLegalArchiveManifest(q1Period, [splitDocument], attachments)
  const q2Manifest = buildLegalArchiveManifest(q2Period, [splitDocument], attachments)

  assert.deepEqual(
    q1Manifest.sources.map((source) => ({
      sourceTransactionId: source.sourceTransactionId,
      includesVat: source.includesVat,
      includesWithholding: source.includesWithholding,
    })),
    [
      {
        sourceTransactionId: "tx_q1_002",
        includesVat: true,
        includesWithholding: false,
      },
    ]
  )

  assert.deepEqual(
    q2Manifest.sources.map((source) => ({
      sourceTransactionId: source.sourceTransactionId,
      includesVat: source.includesVat,
      includesWithholding: source.includesWithholding,
    })),
    [
      {
        sourceTransactionId: "tx_q1_002",
        includesVat: false,
        includesWithholding: true,
      },
    ]
  )
})
