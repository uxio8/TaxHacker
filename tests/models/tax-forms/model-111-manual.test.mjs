import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

import { loadModel111ManualForTenant } from "../../../models/tax-forms/model-111-manual.ts"

async function readSource(relativePath) {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8")
}

function createQuarterlyDraft(periodKey, status = "open") {
  return {
    period: {
      fiscalYear: Number.parseInt(periodKey.slice(0, 4), 10),
      quarter: Number.parseInt(periodKey.slice(-1), 10),
      periodKey,
      status,
    },
    periodHref: `/tax/quarters/${periodKey}`,
    operationalStatus: {
      code: status === "closed" ? "closed" : "open",
      periodStatus: status,
      documentCount: 0,
      readyDocumentCount: 0,
      reviewDocumentCount: 0,
      blockingDocumentCount: 0,
    },
    reviewStatusCounts: {
      ready: 0,
      needs_review: 0,
      blocked: 0,
      pending: 0,
    },
    reviewStatusTotals: {},
    totals: {
      documentCount: 0,
      observedAmountCents: 0,
      totalNetCents: 0,
      totalVatCents: 0,
      totalWithholdingCents: 0,
      totalGrossCents: 0,
      totalPayableCents: 0,
      model303DocumentCount: 0,
      model115DocumentCount: 0,
    },
    model303DocumentIds: [],
    model115DocumentIds: [],
    documents: [],
  }
}

test("loadModel111ManualForTenant devuelve un resumen manual explicito con evidencia externa obligatoria", async () => {
  const result = await loadModel111ManualForTenant(
    {
      organizationId: "org_1",
      userId: "user_1",
      periodKey: "2026-Q2",
    },
    {
      now: new Date("2026-06-15T10:00:00.000Z"),
      getFiscalProfileAccessByOrganizationId: async (organizationId, userId) => {
        assert.equal(organizationId, "org_1")
        assert.equal(userId, "user_1")

        return {
          status: "ready",
          profile: {
            id: "fp_1",
            companyName: "Acme S.L.",
            taxId: "B12345678",
            hasEmployees: true,
            hasProfessionalWithholding: false,
          },
        }
      },
      listQuarterlyDrafts: async () => [
        createQuarterlyDraft("2026-Q1", "closed"),
        createQuarterlyDraft("2026-Q2"),
      ],
    }
  )

  assert.equal(result.status, "ready")
  assert.equal(result.profile.companyName, "Acme S.L.")
  assert.equal(result.period.periodKey, "2026-Q2")
  assert.equal(result.period.selectionSource, "requested")
  assert.deepEqual(result.availablePeriodKeys, ["2026-Q1", "2026-Q2"])
  assert.equal(result.manual.mode, "manual_quarterly_summary")
  assert.equal(result.manual.automation.isAutomated, false)
  assert.match(result.manual.automation.label, /No automatizado/)
  assert.match(result.manual.automation.detail, /no calcula/i)
  assert.equal(result.manual.evidence.externalEvidenceRequired, true)
  assert.deepEqual(result.manual.evidence.requiredEvidenceCodes, [
    "external_payroll_summary",
    "filing_receipt",
  ])
  assert.match(result.manual.evidence.detail, /evidencia externa/i)
  assert.equal(result.manual.applies, true)
})

test("loadModel111ManualForTenant cae al trimestre activo y marca no aplicable cuando el perfil no tiene retenciones 111", async () => {
  const result = await loadModel111ManualForTenant(
    {
      organizationId: "org_1",
      userId: "user_1",
    },
    {
      now: new Date("2026-03-01T10:00:00.000Z"),
      getFiscalProfileAccessByOrganizationId: async () => ({
        status: "ready",
        profile: {
          id: "fp_1",
          companyName: "Acme S.L.",
          taxId: "B12345678",
          hasEmployees: false,
          hasProfessionalWithholding: false,
        },
      }),
      listQuarterlyDrafts: async () => [
        createQuarterlyDraft("2025-Q4", "closed"),
        createQuarterlyDraft("2026-Q1"),
      ],
    }
  )

  assert.equal(result.status, "ready")
  assert.equal(result.period.periodKey, "2026-Q1")
  assert.equal(result.period.selectionSource, "active")
  assert.equal(result.manual.applies, false)
  assert.match(result.manual.readinessLabel, /No aplica/)
})

test("loadModel111ManualForTenant usa el trimestre actual como fallback si todavia no hay periodos fiscales", async () => {
  const result = await loadModel111ManualForTenant(
    {
      organizationId: "org_1",
      userId: "user_1",
    },
    {
      now: new Date("2026-11-20T10:00:00.000Z"),
      getFiscalProfileAccessByOrganizationId: async () => ({
        status: "ready",
        profile: {
          id: "fp_1",
          companyName: "Acme S.L.",
          taxId: "B12345678",
          hasEmployees: true,
          hasProfessionalWithholding: false,
        },
      }),
      listQuarterlyDrafts: async () => [],
    }
  )

  assert.equal(result.status, "ready")
  assert.equal(result.period.periodKey, "2026-Q4")
  assert.equal(result.period.selectionSource, "active")
  assert.deepEqual(result.availablePeriodKeys, [])
})

test("loadModel111ManualForTenant propaga profile_missing y storage_not_ready sin construir un falso borrador", async () => {
  const missingProfile = await loadModel111ManualForTenant(
    {
      organizationId: "org_1",
      userId: "user_1",
    },
    {
      getFiscalProfileAccessByOrganizationId: async () => ({
        status: "profile_missing",
        profile: null,
      }),
      listQuarterlyDrafts: async () => {
        throw new Error("no deberia listar periodos sin perfil")
      },
    }
  )

  const storageNotReady = await loadModel111ManualForTenant(
    {
      organizationId: "org_1",
      userId: "user_1",
    },
    {
      getFiscalProfileAccessByOrganizationId: async () => ({
        status: "storage_not_ready",
        profile: null,
      }),
      listQuarterlyDrafts: async () => {
        throw new Error("no deberia listar periodos con storage no listo")
      },
    }
  )

  assert.deepEqual(missingProfile, {
    status: "profile_missing",
    availablePeriodKeys: [],
  })
  assert.deepEqual(storageNotReady, {
    status: "storage_not_ready",
    availablePeriodKeys: [],
  })
})

test("el 111 se presenta como manual y con evidencia externa en la UI y en el indice de formularios", async () => {
  const pageSource = await readSource("app/(app)/tax/forms/111/page.tsx")
  const viewSource = await readSource("components/tax/forms/111/model-111-manual-view.tsx")
  const formsIndexSource = await readSource("app/(app)/tax/forms/page.tsx")

  assert.match(pageSource, /Modelo 111 manual/)
  assert.match(viewSource, /manual\.automation\.label/)
  assert.match(viewSource, /Evidencia externa obligatoria/)
  assert.match(viewSource, /cálculo automático/i)
  assert.match(formsIndexSource, /Modelo 111 manual/)
  assert.match(formsIndexSource, /evidencia externa/i)
})
