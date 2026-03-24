import { getFiscalProfileAccessByOrganizationId, type FiscalProfileAccess } from "../fiscal/profile.ts"
import { listOrganizationsForUser } from "../organizations.ts"
import { getDashboardWorkflowDocumentView } from "./document-read-api.ts"
import { getTaxWorkflowFiscalView, type TaxWorkflowProfile } from "./fiscal-read-api.ts"
import type { PeriodClosurePosture, WorkflowItem } from "./contracts.ts"
import { WORKFLOW_ITEM_STATUS } from "./contracts.ts"
import { buildWorkflowReadModelFromSlices } from "./rebuild.ts"

type WorkflowPortfolioOrganization = {
  id: string
  name: string
  role: string
}

type DashboardWorkflowPortfolioView = Pick<
  Awaited<ReturnType<typeof getDashboardWorkflowDocumentView>>,
  "attentionWorkflow"
>

type TaxWorkflowPortfolioView = Pick<Awaited<ReturnType<typeof getTaxWorkflowFiscalView>>, "workflow">

type PortfolioDependencies = {
  listOrganizationsForUser?: (userId: string) => Promise<WorkflowPortfolioOrganization[]>
  getDashboardWorkflowDocumentView?: (input: {
    organizationId: string
    organizationName: string
    userId: string
    businessAddress?: string | null
  }) => Promise<DashboardWorkflowPortfolioView>
  getFiscalProfileAccessByOrganizationId?: (
    organizationId: string,
    userId: string
  ) => Promise<FiscalProfileAccess>
  getTaxWorkflowFiscalView?: (input: {
    organizationId: string
    userId: string
    ownerScopeId: string
    profile: TaxWorkflowProfile
  }) => Promise<TaxWorkflowPortfolioView>
}

export type WorkflowPortfolioProjection = {
  organizationId: string
  organizationName: string
  role: string
  posture: PeriodClosurePosture
  topException: WorkflowItem | null
  nextDueAt: string | null
  itemCount: number
}

function mapTaxWorkflowProfile(access: Extract<FiscalProfileAccess, { status: "ready" }>): TaxWorkflowProfile {
  return {
    organizationId: access.profile.organizationId,
    companyName: access.profile.companyName,
    taxId: access.profile.taxId,
    annualCloseMonth: access.profile.annualCloseMonth,
    issuesInvoices: access.profile.issuesInvoices,
    hasRentWithholding: access.profile.hasRentWithholding,
    hasIntraEuOperations: access.profile.hasIntraEuOperations,
    hasEmployees: access.profile.hasEmployees,
    hasProfessionalWithholding: access.profile.hasProfessionalWithholding,
  }
}

function resolveNextDueAt(items: WorkflowItem[]) {
  const nextDueAt = items
    .filter(
      (item) =>
        item.dueAt &&
        item.status !== WORKFLOW_ITEM_STATUS.FILED &&
        item.status !== WORKFLOW_ITEM_STATUS.ARCHIVED
    )
    .map((item) => item.dueAt as string)
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0]

  return nextDueAt ?? null
}

function postureWeight(code: PeriodClosurePosture["code"]) {
  switch (code) {
    case "blocked":
      return 0
    case "at_risk":
      return 1
    case "defendible":
      return 2
    case "filed":
      return 3
    case "archived":
      return 4
    case "on_track":
    default:
      return 5
  }
}

function comparePortfolioProjections(left: WorkflowPortfolioProjection, right: WorkflowPortfolioProjection) {
  const postureDelta = postureWeight(left.posture.code) - postureWeight(right.posture.code)
  if (postureDelta !== 0) {
    return postureDelta
  }

  if (left.nextDueAt && right.nextDueAt) {
    const dueDelta = new Date(left.nextDueAt).getTime() - new Date(right.nextDueAt).getTime()
    if (dueDelta !== 0) {
      return dueDelta
    }
  }

  if (left.nextDueAt && !right.nextDueAt) {
    return -1
  }

  if (!left.nextDueAt && right.nextDueAt) {
    return 1
  }

  return left.organizationName.localeCompare(right.organizationName)
}

export async function getWorkflowPortfolioProjectionForOrganization(
  input: {
    organizationId: string
    organizationName: string
    role: string
    userId: string
  },
  dependencies: PortfolioDependencies = {}
): Promise<WorkflowPortfolioProjection> {
  const loadDashboardWorkflow = dependencies.getDashboardWorkflowDocumentView ?? getDashboardWorkflowDocumentView
  const loadFiscalProfileAccess =
    dependencies.getFiscalProfileAccessByOrganizationId ?? getFiscalProfileAccessByOrganizationId
  const loadTaxWorkflow = dependencies.getTaxWorkflowFiscalView ?? getTaxWorkflowFiscalView

  const dashboardView = await loadDashboardWorkflow({
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    userId: input.userId,
    businessAddress: null,
  })

  const fiscalProfileAccess = await loadFiscalProfileAccess(input.organizationId, input.userId)
  const fiscalWorkflow =
    fiscalProfileAccess.status === "ready"
      ? await loadTaxWorkflow({
          organizationId: input.organizationId,
          userId: input.userId,
          ownerScopeId: fiscalProfileAccess.profile.id,
          profile: mapTaxWorkflowProfile(fiscalProfileAccess),
        })
      : null

  const combinedWorkflow = buildWorkflowReadModelFromSlices({
    readiness: null,
    items: [
      ...dashboardView.attentionWorkflow.items,
      ...(fiscalWorkflow?.workflow.items ?? []),
    ],
  })

  return {
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    role: input.role,
    posture: combinedWorkflow.posture,
    topException: combinedWorkflow.topItem,
    nextDueAt: resolveNextDueAt(combinedWorkflow.items),
    itemCount: combinedWorkflow.items.length,
  }
}

export async function listWorkflowPortfolioProjectionsForUser(
  userId: string,
  dependencies: PortfolioDependencies = {}
) {
  const loadOrganizations = dependencies.listOrganizationsForUser ?? listOrganizationsForUser
  const organizations = await loadOrganizations(userId)

  const projections = await Promise.all(
    organizations.map((organization) =>
      getWorkflowPortfolioProjectionForOrganization(
        {
          organizationId: organization.id,
          organizationName: organization.name,
          role: organization.role,
          userId,
        },
        dependencies
      )
    )
  )

  return projections.sort(comparePortfolioProjections)
}
