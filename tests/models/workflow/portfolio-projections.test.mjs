import assert from "node:assert/strict"
import test from "node:test"

import {
  getWorkflowPortfolioProjectionForOrganization,
  listWorkflowPortfolioProjectionsForUser,
} from "../../../models/workflow/portfolio-projections.ts"
import {
  PERIOD_CLOSURE_POSTURE,
  WORKFLOW_CONFIDENCE,
  WORKFLOW_ITEM_SOURCE,
  WORKFLOW_ITEM_STATUS,
  WORKFLOW_MATERIALITY,
  WORKFLOW_SURFACE,
} from "../../../models/workflow/contracts.ts"
import { buildWorkflowReadModelFromSlices } from "../../../models/workflow/rebuild.ts"

function createWorkflowItem(overrides = {}) {
  return {
    id: "item_1",
    title: "Documento pendiente",
    description: "Falta revisar la evidencia",
    href: "/unsorted/file_1",
    count: 1,
    status: WORKFLOW_ITEM_STATUS.NEEDS_ACTION,
    source: WORKFLOW_ITEM_SOURCE.DOCUMENTS,
    recommendedSurface: WORKFLOW_SURFACE.UNSORTED,
    materiality: WORKFLOW_MATERIALITY.MEDIUM,
    confidence: WORKFLOW_CONFIDENCE.MEDIUM,
    owner: null,
    dueAt: null,
    nextAction: {
      kind: "open",
      label: "Revisar documento",
      href: "/unsorted/file_1",
    },
    blockingReason: null,
    requiresDesktop: false,
    ...overrides,
  }
}

test("getWorkflowPortfolioProjectionForOrganization combina posture, top exception y siguiente vencimiento", async () => {
  const projection = await getWorkflowPortfolioProjectionForOrganization(
    {
      organizationId: "org_1",
      organizationName: "Acme SL",
      role: "owner",
      userId: "user_1",
    },
    {
      getDashboardWorkflowDocumentView: async () => ({
        attentionWorkflow: buildWorkflowReadModelFromSlices({
          readiness: { pending: 1 },
          items: [
            createWorkflowItem({
              id: "document:blocker",
              status: WORKFLOW_ITEM_STATUS.BLOCKED,
              materiality: WORKFLOW_MATERIALITY.HIGH,
              title: "Factura bloqueada",
            }),
          ],
        }),
      }),
      getFiscalProfileAccessByOrganizationId: async () => ({
        status: "ready",
        profile: {
          id: "fp_1",
          organizationId: "org_1",
          companyName: "Acme SL",
          taxId: "B12345678",
          annualCloseMonth: 12,
          issuesInvoices: true,
          hasRentWithholding: true,
          hasIntraEuOperations: false,
          hasEmployees: false,
          hasProfessionalWithholding: false,
        },
      }),
      getTaxWorkflowFiscalView: async () => ({
        workflow: buildWorkflowReadModelFromSlices({
          readiness: { blocked: 0, needs_review: 0 },
          items: [
            createWorkflowItem({
              id: "obligation:303",
              title: "Modelo 303",
              source: WORKFLOW_ITEM_SOURCE.FISCAL,
              recommendedSurface: WORKFLOW_SURFACE.TAX,
              status: WORKFLOW_ITEM_STATUS.READY,
              dueAt: "2026-04-20T00:00:00.000Z",
              nextAction: {
                kind: "open",
                label: "Preparar modelo",
                href: "/tax/forms/303?period=2026-Q1",
              },
            }),
          ],
        }),
      }),
    }
  )

  assert.equal(projection.organizationId, "org_1")
  assert.equal(projection.organizationName, "Acme SL")
  assert.equal(projection.role, "owner")
  assert.equal(projection.posture.code, PERIOD_CLOSURE_POSTURE.BLOCKED)
  assert.equal(projection.topException?.id, "document:blocker")
  assert.equal(projection.topException?.recommendedSurface, WORKFLOW_SURFACE.UNSORTED)
  assert.equal(projection.nextDueAt, "2026-04-20T00:00:00.000Z")
})

test("listWorkflowPortfolioProjectionsForUser usa solo workflow documental cuando fiscal no está listo", async () => {
  const projections = await listWorkflowPortfolioProjectionsForUser("user_1", {
    listOrganizationsForUser: async () => [
      { id: "org_1", name: "Acme SL", role: "owner" },
      { id: "org_2", name: "Beta SL", role: "admin" },
    ],
    getDashboardWorkflowDocumentView: async ({ organizationId }) => ({
      attentionWorkflow: buildWorkflowReadModelFromSlices({
        readiness: { pending: organizationId === "org_1" ? 1 : 0 },
        items:
          organizationId === "org_1"
            ? [
                createWorkflowItem({
                  id: "document:org_1",
                  title: "Pendiente cliente",
                  status: WORKFLOW_ITEM_STATUS.NEEDS_ACTION,
                }),
              ]
            : [],
      }),
    }),
    getFiscalProfileAccessByOrganizationId: async (organizationId) =>
      organizationId === "org_1"
        ? {
            status: "profile_missing",
            profile: null,
          }
        : {
            status: "storage_not_ready",
            profile: null,
          },
  })

  assert.equal(projections.length, 2)
  assert.equal(projections[0]?.organizationId, "org_1")
  assert.equal(projections[0]?.topException?.id, "document:org_1")
  assert.equal(projections[0]?.nextDueAt, null)
  assert.equal(projections[1]?.posture.code, PERIOD_CLOSURE_POSTURE.ON_TRACK)
})
