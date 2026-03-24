import assert from "node:assert/strict"
import test from "node:test"

import {
  getAnnualArchiveWorkflowView,
  getLegacyTaxWorkspaceView,
  getTaxArchivePeriodWorkflowView,
  getTaxArchiveWorkflowView,
  getTaxWorkflowFiscalView,
} from "../../../models/workflow/fiscal-read-api.ts"

function createProfile(overrides = {}) {
  return {
    organizationId: "org_1",
    companyName: "Acme SL",
    taxId: "B12345678",
    annualCloseMonth: 12,
    issuesInvoices: true,
    hasRentWithholding: true,
    hasIntraEuOperations: false,
    hasEmployees: true,
    hasProfessionalWithholding: false,
    ...overrides,
  }
}

function createQuarterlyObligation(overrides = {}) {
  return {
    id: "obl_demo",
    organizationId: "org_1",
    ownerScopeId: "profile_1",
    code: "303",
    fiscalYear: 2026,
    quarter: 1,
    periodKey: "2026-Q1",
    status: "ready_to_file",
    dueDate: new Date("2026-04-20T00:00:00.000Z"),
    owner: "advisor",
    blockingReasons: [],
    requiredEvidence: ["source_documents", "filing_receipt"],
    filingReference: null,
    filedAt: null,
    filedByUserId: null,
    notes: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  }
}

test("getTaxWorkflowFiscalView unifica atención, obligaciones trimestrales y capa anual sobre una read API estable", async () => {
  const syncCalls = []
  const result = await getTaxWorkflowFiscalView(
    {
      organizationId: "org_1",
      userId: "user_1",
      ownerScopeId: "profile_1",
      profile: createProfile(),
    },
    {
      getTaxAttention: async () => ({
        activeQuarter: {
          href: "/tax/quarters/2026-Q1",
          periodKey: "2026-Q1",
          status: "review_blocked",
        },
        summary: {
          blockedDocuments: 2,
          needsReviewDocuments: 1,
        },
        nextAction: {
          kind: "review_blocked",
          href: "/tax/review",
          moduleId: "review",
        },
      }),
      loadModel303ForTenant: async () => ({
        periodKey: "2026-Q1",
        readiness: {
          status: "ready",
          label: "Listo para preparar",
          summary: {
            blockingDocumentCount: 0,
            reviewDocumentCount: 0,
            skippedDocumentCount: 0,
          },
        },
      }),
      loadModel115DraftForTenant: async () => ({
        status: "ready",
        period: {
          periodKey: "2026-Q1",
        },
        readiness: {
          candidate_document_count: 1,
          included_document_count: 1,
          blocked_document_count: 1,
          needs_review_document_count: 0,
          pending_document_count: 0,
        },
      }),
      loadModel111ManualForTenant: async () => ({
        status: "ready",
        period: {
          periodKey: "2026-Q1",
        },
        manual: {
          applies: true,
        },
      }),
      getCounterparties: async () => [],
      syncFiscalObligationsForOrganization: async (organizationId) => {
        syncCalls.push(organizationId)
        return [
          createQuarterlyObligation(),
          createQuarterlyObligation({
            id: "obl_115",
            code: "115",
            status: "needs_review",
            owner: "client",
            blockingReasons: ["missing_documents"],
          }),
          createQuarterlyObligation({
            id: "obl_111",
            code: "111_manual",
            status: "draft_ready",
            owner: "shared",
          }),
          createQuarterlyObligation({
            id: "obl_180",
            code: "180",
            fiscalYear: 2025,
            quarter: null,
            periodKey: "2025-Y",
            dueDate: new Date("2026-01-30T00:00:00.000Z"),
            owner: "advisor",
          }),
          createQuarterlyObligation({
            id: "obl_390",
            code: "390",
            fiscalYear: 2025,
            quarter: null,
            periodKey: "2025-Y",
            dueDate: new Date("2026-01-30T00:00:00.000Z"),
            owner: "advisor",
          }),
        ]
      },
    }
  )

  assert.deepEqual(syncCalls, ["org_1"])
  assert.equal(result.attention.activeQuarter?.periodKey, "2026-Q1")
  assert.equal(result.obligations.length, 3)
  assert.deepEqual(
    result.obligations.map((item) => item.code),
    ["303", "115", "111"]
  )
  assert.equal(result.workflow.posture.code, "blocked")
  assert.equal(result.workflow.topItem?.title, "Modelo 115")
  assert.equal(result.annualOverview.fiscalYear, 2025)
  assert.deepEqual(
    result.annualOverview.items.map((item) => item.code),
    ["180", "390"]
  )
  assert.match(result.annualOverview.handoffSummary, /ítems listos o presentados/i)
})

test("getLegacyTaxWorkspaceView conserva el workspace fiscal legado sobre la misma semántica", async () => {
  const result = await getLegacyTaxWorkspaceView(
    {
      organizationId: "org_1",
      userId: "user_1",
      ownerScopeId: "profile_1",
      profile: createProfile(),
    },
    {
      getTaxAttention: async () => ({
        activeQuarter: {
          href: "/tax/quarters/2026-Q1",
          periodKey: "2026-Q1",
          status: "review_blocked",
        },
        summary: {
          blockedDocuments: 1,
          needsReviewDocuments: 0,
        },
        nextAction: {
          kind: "review_blocked",
          href: "/tax/review",
          moduleId: "review",
        },
      }),
      loadModel303ForTenant: async () => ({
        periodKey: "2026-Q1",
        readiness: {
          status: "ready",
          label: "Listo para preparar",
          summary: {
            blockingDocumentCount: 0,
            reviewDocumentCount: 0,
            skippedDocumentCount: 0,
          },
        },
      }),
      loadModel115DraftForTenant: async () => ({
        status: "ready",
        period: {
          periodKey: "2026-Q1",
        },
        readiness: {
          candidate_document_count: 0,
          included_document_count: 0,
          blocked_document_count: 0,
          needs_review_document_count: 0,
          pending_document_count: 0,
        },
      }),
      loadModel111ManualForTenant: async () => ({
        status: "ready",
        period: {
          periodKey: "2026-Q1",
        },
        manual: {
          applies: false,
        },
      }),
      getCounterparties: async () => [],
      syncFiscalObligationsForOrganization: async () => [
        createQuarterlyObligation({
          code: "303",
          status: "ready_to_file",
        }),
        createQuarterlyObligation({
          id: "obl_115",
          code: "115",
          status: "waiting_on_documents",
          owner: "client",
        }),
        createQuarterlyObligation({
          id: "obl_390",
          code: "390",
          fiscalYear: 2025,
          quarter: null,
          periodKey: "2025-Y",
          dueDate: new Date("2026-01-30T00:00:00.000Z"),
          owner: "advisor",
        }),
      ],
    }
  )

  assert.equal(result.attention.activeQuarter?.periodKey, "2026-Q1")
  assert.deepEqual(
    result.obligations.map((item) => item.code),
    ["303", "115", "111"]
  )
  assert.equal(result.obligations[2]?.statusLabel, "No aplica")
  assert.equal(result.annualOverview.fiscalYear, 2025)
})

test("getTaxArchiveWorkflowView sincroniza periodos y devuelve el archivo fiscal estable", async () => {
  const syncCalls = []
  const periods = [
    {
      period: {
        id: "period_2026_q1",
        periodKey: "2026-Q1",
        startsOn: "2026-01-01",
        endsOn: "2026-03-31",
        status: "ready",
      },
      manifest: {
        totals: {
          expectedSourceCount: 8,
          missingSourceCount: 1,
          unexpectedSourceCount: 0,
        },
      },
      attachmentResolution: {
        unresolvedAttachmentCount: 2,
      },
    },
  ]

  const result = await getTaxArchiveWorkflowView(
    {
      organizationId: "org_1",
      ownerScopeId: "profile_1",
    },
    {
      syncDefaultSpanishFiscalPeriodsV1: async (ownerScopeId) => {
        syncCalls.push(ownerScopeId)
      },
      listLegalArchivePeriods: async () => periods,
    }
  )

  assert.deepEqual(syncCalls, ["profile_1"])
  assert.equal(result.periods.length, 1)
  assert.equal(result.periods[0].period.periodKey, "2026-Q1")
})

test("getTaxArchivePeriodWorkflowView sincroniza periodos y devuelve el detalle del periodo archivado", async () => {
  const syncCalls = []
  const detail = {
    period: {
      id: "period_2026_q1",
      periodKey: "2026-Q1",
      startsOn: "2026-01-01",
      endsOn: "2026-03-31",
      status: "ready",
    },
    manifest: {
      totals: {
        expectedSourceCount: 8,
        missingSourceCount: 1,
        unexpectedSourceCount: 0,
      },
      filings: [],
    },
    attachmentResolution: {
      unresolvedAttachmentCount: 2,
    },
    unresolvedSources: [],
  }

  const result = await getTaxArchivePeriodWorkflowView(
    {
      organizationId: "org_1",
      ownerScopeId: "profile_1",
      periodKey: "2026-Q1",
    },
    {
      syncDefaultSpanishFiscalPeriodsV1: async (ownerScopeId) => {
        syncCalls.push(ownerScopeId)
      },
      getLegalArchivePeriodDetail: async () => detail,
    }
  )

  assert.deepEqual(syncCalls, ["profile_1"])
  assert.equal(result.detail?.period.periodKey, "2026-Q1")
  assert.equal(result.detail?.attachmentResolution.unresolvedAttachmentCount, 2)
})

test("getAnnualArchiveWorkflowView resuelve el handoff anual desde una API estable", async () => {
  const pack = {
    fiscalYear: 2025,
    periodKey: "2025-Y",
    automationMode: "handoff_only",
    companyName: "Acme SL",
    taxId: "B12345678",
    summary: {
      totalItems: 5,
      readyOrFiledItems: 2,
      blockedItems: 1,
    },
    items: [
      {
        code: "200_handoff",
        title: "Impuesto sobre Sociedades",
        kind: "tax",
        status: "waiting_on_documents",
        owner: "advisor",
        dueDate: "2026-07-25",
        requiredEvidence: ["draft_export", "filing_receipt"],
        blockingReasons: ["missing_export"],
        notes: "Seguimiento anual",
        trackingNotes: null,
      },
    ],
  }

  const result = await getAnnualArchiveWorkflowView(
    {
      organizationId: "org_1",
      profile: createProfile(),
    },
    {
      getAnnualHandoffPackForOrganization: async () => pack,
    }
  )

  assert.equal(result.pack.periodKey, "2025-Y")
  assert.equal(result.pack.summary.blockedItems, 1)
  assert.equal(result.pack.items[0].code, "200_handoff")
})
