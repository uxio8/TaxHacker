import assert from "node:assert/strict"
import test from "node:test"

import {
  buildFiscalObligations,
  getFiscalObligationByCodeAndPeriod,
  syncFiscalObligationsForOrganization,
  updateFiscalObligationFilingState,
  updateFiscalObligationOperationalState,
} from "../../../models/fiscal/obligations.ts"

function createProfile(overrides = {}) {
  return {
    id: "org_1",
    organizationId: "org_1",
    hasEmployees: false,
    hasRentWithholding: false,
    hasProfessionalWithholding: false,
    hasIntraEuOperations: false,
    issuesInvoices: true,
    annualCloseMonth: 12,
    ...overrides,
  }
}

function createQuarterlyDraft(overrides = {}) {
  return {
    period: {
      id: "period_q1",
      ownerScopeId: "org_1",
      fiscalYear: 2026,
      quarter: 1,
      periodKey: "2026-Q1",
      status: "open",
      startsOn: "2026-01-01",
      endsOn: "2026-03-31",
      countryCode: "ES",
      currencyCode: "EUR",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    operationalStatus: {
      code: "ready",
      periodStatus: "open",
      documentCount: 3,
      readyDocumentCount: 3,
      reviewDocumentCount: 0,
      blockingDocumentCount: 0,
    },
    totals: {
      model303DocumentCount: 2,
      model115DocumentCount: 1,
    },
    ...overrides,
  }
}

test("buildFiscalObligations crea obligaciones trimestrales y anuales aplicables desde el perfil fiscal", () => {
  const obligations = buildFiscalObligations({
    profile: createProfile({
      hasEmployees: true,
      hasRentWithholding: true,
      hasProfessionalWithholding: false,
      hasIntraEuOperations: false,
    }),
    drafts: [createQuarterlyDraft()],
  })

  const obligationKeys = obligations.map((obligation) => `${obligation.code}:${obligation.periodKey}`).sort()

  assert.deepEqual(obligationKeys, [
    "111_manual:2026-Q1",
    "115:2026-Q1",
    "180:2026-Y",
    "200_handoff:2026-Y",
    "202_handoff:2026-Y",
    "303:2026-Q1",
    "347:2026-Y",
    "349:2026-Y",
    "390:2026-Y",
    "annual_accounts:2026-Y",
    "book_legalization:2026-Y",
    "mercantile_filing:2026-Y",
  ])
  assert.equal(
    obligations.find((obligation) => obligation.code === "349" && obligation.periodKey === "2026-Y")?.status,
    "not_applicable"
  )
})

test("buildFiscalObligations marca 349 solo cuando hay operativa intracomunitaria y respeta estados del trimestre", () => {
  const obligations = buildFiscalObligations({
    profile: createProfile({
      hasIntraEuOperations: true,
    }),
    drafts: [
      createQuarterlyDraft({
        period: {
          id: "period_q4",
          ownerScopeId: "org_1",
          fiscalYear: 2026,
          quarter: 4,
          periodKey: "2026-Q4",
          status: "presented",
          startsOn: "2026-10-01",
          endsOn: "2026-12-31",
          countryCode: "ES",
          currencyCode: "EUR",
          createdAt: "2026-10-01T00:00:00.000Z",
          updatedAt: "2026-10-01T00:00:00.000Z",
        },
        operationalStatus: {
          code: "presented",
          periodStatus: "presented",
          documentCount: 0,
          readyDocumentCount: 0,
          reviewDocumentCount: 0,
          blockingDocumentCount: 0,
        },
        totals: {
          model303DocumentCount: 0,
          model115DocumentCount: 0,
        },
      }),
    ],
  })

  assert.equal(
    obligations.find((obligation) => obligation.code === "303" && obligation.periodKey === "2026-Q4")?.status,
    "filed"
  )
  assert.equal(
    obligations.find((obligation) => obligation.code === "349" && obligation.periodKey === "2026-Y")?.status,
    "waiting_on_documents"
  )
})

test("syncFiscalObligationsForOrganization hace upsert por organizationId, code y periodKey", async () => {
  const upsertCalls = []
  const obligations = await syncFiscalObligationsForOrganization("org_1", {
    fiscalProfile: {
      findUnique: async () => createProfile({ hasRentWithholding: true }),
    },
    fiscalPeriod: {
      findMany: async () => [
        {
          id: "period_q1",
          ownerScopeId: "org_1",
          fiscalYear: 2026,
          quarter: 1,
          periodKey: "2026-Q1",
          status: "open",
          startsOn: new Date("2026-01-01"),
          endsOn: new Date("2026-03-31"),
          countryCode: "ES",
          currencyCode: "EUR",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    },
    fiscalObligation: {
      findMany: async () => [],
      upsert: async (args) => {
        upsertCalls.push(args)
        return args.create
      },
    },
  })

  assert.equal(obligations.length > 0, true)
  assert.deepEqual(upsertCalls[0]?.where, {
    organizationId_code_periodKey: {
      organizationId: "org_1",
      code: "303",
      periodKey: "2026-Q1",
    },
  })
})

test("syncFiscalObligationsForOrganization preserva estado y metadatos manuales de filing", async () => {
  const upsertCalls = []

  await syncFiscalObligationsForOrganization("org_1", {
    fiscalProfile: {
      findUnique: async () => createProfile(),
    },
    fiscalPeriod: {
      findMany: async () => [
        {
          id: "period_q1",
          ownerScopeId: "org_1",
          fiscalYear: 2026,
          quarter: 1,
          periodKey: "2026-Q1",
          status: "open",
          startsOn: new Date("2026-01-01"),
          endsOn: new Date("2026-03-31"),
          countryCode: "ES",
          currencyCode: "EUR",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    },
    fiscalObligation: {
      findMany: async () => [
        {
          organizationId: "org_1",
          ownerScopeId: "org_1",
          code: "303",
          fiscalYear: 2026,
          quarter: 1,
          periodKey: "2026-Q1",
          status: "filed",
          dueDate: new Date("2026-04-20"),
          owner: "advisor",
          blockingReasons: [],
          requiredEvidence: ["source_documents", "filing_receipt"],
          filingReference: "CSV-303-2026-Q1",
          filedAt: new Date("2026-04-18T09:30:00.000Z"),
          filedByUserId: "user_1",
          notes: "Presentado fuera de TaxHacker",
        },
      ],
      upsert: async (args) => {
        upsertCalls.push(args)
        return args.create
      },
    },
  })

  const preserved303 = upsertCalls.find(
    (call) => call.where.organizationId_code_periodKey.code === "303"
  )

  assert.equal(preserved303?.update.status, "filed")
  assert.equal(preserved303?.update.filingReference, "CSV-303-2026-Q1")
  assert.equal(
    preserved303?.update.filedAt?.toISOString(),
    "2026-04-18T09:30:00.000Z"
  )
  assert.equal(preserved303?.update.filedByUserId, "user_1")
  assert.equal(preserved303?.update.notes, "Presentado fuera de TaxHacker")
})

test("syncFiscalObligationsForOrganization preserva el estado manual del handoff anual", async () => {
  const upsertCalls = []

  await syncFiscalObligationsForOrganization("org_1", {
    fiscalProfile: {
      findUnique: async () => createProfile(),
    },
    fiscalPeriod: {
      findMany: async () => [
        {
          id: "period_q1",
          ownerScopeId: "org_1",
          fiscalYear: 2026,
          quarter: 1,
          periodKey: "2026-Q1",
          status: "open",
          startsOn: new Date("2026-01-01"),
          endsOn: new Date("2026-03-31"),
          countryCode: "ES",
          currencyCode: "EUR",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    },
    fiscalObligation: {
      findMany: async () => [
        {
          organizationId: "org_1",
          ownerScopeId: "org_1",
          code: "202_handoff",
          fiscalYear: 2026,
          quarter: null,
          periodKey: "2026-Y",
          status: "needs_review",
          dueDate: new Date("2026-12-20"),
          owner: "shared",
          blockingReasons: [],
          requiredEvidence: ["draft_export", "filing_receipt"],
          filingReference: null,
          filedAt: null,
          filedByUserId: null,
          notes: "Pendiente revisar el soporte anual.",
        },
      ],
      upsert: async (args) => {
        upsertCalls.push(args)
        return args.create
      },
    },
  })

  const preservedAnnualItem = upsertCalls.find(
    (call) => call.where.organizationId_code_periodKey.code === "202_handoff"
  )

  assert.equal(preservedAnnualItem?.update.status, "needs_review")
  assert.equal(preservedAnnualItem?.update.owner, "shared")
  assert.equal(preservedAnnualItem?.update.notes, "Pendiente revisar el soporte anual.")
})

test("getFiscalObligationByCodeAndPeriod resuelve una obligación concreta", async () => {
  const obligation = await getFiscalObligationByCodeAndPeriod("org_1", "115", "2026-Q1", {
    fiscalProfile: {
      findUnique: async () => null,
    },
    fiscalPeriod: {
      findMany: async () => [],
    },
    fiscalObligation: {
      findMany: async () => [],
      findUnique: async (args) => {
        assert.deepEqual(args, {
          where: {
            organizationId_code_periodKey: {
              organizationId: "org_1",
              code: "115",
              periodKey: "2026-Q1",
            },
          },
        })

        return {
          id: "obligation_115_q1",
          organizationId: "org_1",
          ownerScopeId: "org_1",
          code: "115",
          fiscalYear: 2026,
          quarter: 1,
          periodKey: "2026-Q1",
          status: "ready_to_prepare",
          dueDate: new Date("2026-04-20"),
          owner: "advisor",
          blockingReasons: [],
          requiredEvidence: ["source_documents", "filing_receipt"],
          filingReference: null,
          filedAt: null,
          filedByUserId: null,
          notes: null,
        }
      },
      upsert: async () => {
        throw new Error("not implemented")
      },
      update: async () => {
        throw new Error("not implemented")
      },
    },
  })

  assert.equal(obligation?.id, "obligation_115_q1")
  assert.equal(obligation?.status, "ready_to_prepare")
})

test("updateFiscalObligationFilingState actualiza el estado operativo de la obligación", async () => {
  const calls = []

  const updated = await updateFiscalObligationFilingState(
    {
      organizationId: "org_1",
      code: "303",
      periodKey: "2026-Q1",
      status: "ready_to_file",
      filingReference: "BORRADOR-303-Q1",
      filedByUserId: null,
      filedAt: null,
      notes: "Checklist completo",
    },
    {
      fiscalProfile: {
        findUnique: async () => null,
      },
      fiscalPeriod: {
        findMany: async () => [],
      },
      fiscalObligation: {
        findMany: async () => [],
        findUnique: async () => null,
        upsert: async () => {
          throw new Error("not implemented")
        },
        update: async (args) => {
          calls.push(args)
          return {
            id: "obligation_303_q1",
            organizationId: "org_1",
            ownerScopeId: "org_1",
            code: "303",
            fiscalYear: 2026,
            quarter: 1,
            periodKey: "2026-Q1",
            status: args.data.status,
            dueDate: new Date("2026-04-20"),
            owner: "advisor",
            blockingReasons: [],
            requiredEvidence: ["source_documents", "filing_receipt"],
            filingReference: args.data.filingReference,
            filedAt: args.data.filedAt,
            filedByUserId: args.data.filedByUserId,
            notes: args.data.notes,
          }
        },
      },
    }
  )

  assert.equal(updated.status, "ready_to_file")
  assert.equal(updated.filingReference, "BORRADOR-303-Q1")
  assert.deepEqual(calls, [
    {
      where: {
        organizationId_code_periodKey: {
          organizationId: "org_1",
          code: "303",
          periodKey: "2026-Q1",
        },
      },
      data: {
        status: "ready_to_file",
        filingReference: "BORRADOR-303-Q1",
        filedAt: null,
        filedByUserId: null,
        notes: "Checklist completo",
      },
    },
  ])
})

test("updateFiscalObligationOperationalState actualiza owner y notas para handoff anual", async () => {
  const calls = []

  const updated = await updateFiscalObligationOperationalState(
    {
      organizationId: "org_1",
      code: "200_handoff",
      periodKey: "2026-Y",
      status: "needs_review",
      owner: "shared",
      notes: "Falta recibir el balance definitivo para el cierre anual.",
      filedAt: null,
      filedByUserId: null,
    },
    {
      fiscalProfile: {
        findUnique: async () => null,
      },
      fiscalPeriod: {
        findMany: async () => [],
      },
      fiscalObligation: {
        findMany: async () => [],
        findUnique: async () => null,
        upsert: async () => {
          throw new Error("not implemented")
        },
        update: async (args) => {
          calls.push(args)
          return {
            id: "obligation_200_y",
            organizationId: "org_1",
            ownerScopeId: "org_1",
            code: "200_handoff",
            fiscalYear: 2026,
            quarter: null,
            periodKey: "2026-Y",
            status: args.data.status,
            dueDate: new Date("2027-07-25"),
            owner: args.data.owner,
            blockingReasons: [],
            requiredEvidence: ["draft_export", "filing_receipt"],
            filingReference: null,
            filedAt: args.data.filedAt,
            filedByUserId: args.data.filedByUserId,
            notes: args.data.notes,
          }
        },
      },
    }
  )

  assert.equal(updated.status, "needs_review")
  assert.equal(updated.owner, "shared")
  assert.equal(updated.notes, "Falta recibir el balance definitivo para el cierre anual.")
  assert.deepEqual(calls, [
    {
      where: {
        organizationId_code_periodKey: {
          organizationId: "org_1",
          code: "200_handoff",
          periodKey: "2026-Y",
        },
      },
      data: {
        status: "needs_review",
        owner: "shared",
        filedAt: null,
        filedByUserId: null,
        notes: "Falta recibir el balance definitivo para el cierre anual.",
      },
    },
  ])
})
