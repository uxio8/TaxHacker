import { getCounterparties } from "../../fiscal/counterparties.ts"
import {
  getFiscalObligationByCodeAndPeriod,
  syncFiscalObligationsForOrganization,
  type FiscalObligationDetail,
} from "../../fiscal/obligations.ts"
import { loadModel115DraftForTenant } from "../../tax-forms/model-115-loader.ts"
import { loadModel111ManualForTenant } from "../../tax-forms/model-111-manual.ts"
import { loadModel303ForTenant } from "../../tax-forms/model-303-loader.ts"
import { getTaxAttention } from "../../tax-attention.ts"
import { buildFiscalWorkflowItems } from "../projectors/fiscal.ts"
import { buildWorkflowReadModelFromSlices } from "../rebuild.ts"
import { buildAnnualOverview } from "./annual-overview.ts"
import {
  buildModel111BlockingItems,
  buildModel111Readiness,
  buildModel115BlockingItems,
  buildModel115Readiness,
  buildModel303BlockingItems,
  buildNextAction,
  findObligation,
  getResponsibleLabel,
  getStatusLabel,
  getStatusVariant,
  normalizeFiscalOwner,
  resolveDueDateLabel,
  resolveModel111Status,
  resolveModel115Status,
  resolveModel303Status,
} from "./shared.ts"
import type {
  TaxLegacyWorkspaceView,
  TaxWorkflowFiscalView,
  TaxWorkflowObligationItem,
  TaxWorkflowProfile,
} from "./types.ts"
import { resolveAnnualHandoffFiscalYear } from "../../fiscal/annual-handoff.ts"

type TaxWorkflowDependencies = {
  getTaxAttention?: typeof getTaxAttention
  loadModel303ForTenant?: typeof loadModel303ForTenant
  loadModel115DraftForTenant?: typeof loadModel115DraftForTenant
  loadModel111ManualForTenant?: typeof loadModel111ManualForTenant
  getCounterparties?: typeof getCounterparties
  syncFiscalObligationsForOrganization?: typeof syncFiscalObligationsForOrganization
}

type LegacyTaxWorkspaceDependencies = TaxWorkflowDependencies & {
  getFiscalObligationByCodeAndPeriod?: typeof getFiscalObligationByCodeAndPeriod
}

function buildProfileObligationsView(input: {
  obligations: FiscalObligationDetail[]
  model303Data: Awaited<ReturnType<typeof loadModel303ForTenant>>
  model115Data: Awaited<ReturnType<typeof loadModel115DraftForTenant>>
  model111Data: Awaited<ReturnType<typeof loadModel111ManualForTenant>>
}) {
  const obligationsCockpit: TaxWorkflowObligationItem[] = []
  const quarterlyWorkflowObligations: FiscalObligationDetail[] = []

  if (input.model303Data) {
    const obligation303 = findObligation(input.obligations, "303", input.model303Data.periodKey)
    const effectiveStatus = resolveModel303Status(obligation303, input.model303Data.readiness)
    const nextAction = buildNextAction(effectiveStatus, "303", input.model303Data.periodKey)

    if (obligation303) {
      quarterlyWorkflowObligations.push(obligation303)
    }

    obligationsCockpit.push({
      code: "303",
      title: "Modelo 303",
      periodLabel: input.model303Data.periodKey,
      href: `/tax/forms/303?period=${input.model303Data.periodKey}`,
      statusLabel: getStatusLabel(effectiveStatus),
      statusVariant: getStatusVariant(effectiveStatus),
      dueDateLabel: resolveDueDateLabel("303", input.model303Data.periodKey, obligation303),
      readinessLabel: effectiveStatus === "not_applicable" ? "No aplica" : input.model303Data.readiness.label,
      readinessVariant:
        effectiveStatus === "not_applicable"
          ? "outline"
          : input.model303Data.readiness.status === "ready"
            ? "default"
            : "secondary",
      blockingItems: buildModel303BlockingItems(obligation303, input.model303Data.readiness, effectiveStatus),
      responsibleLabel: getResponsibleLabel(effectiveStatus, normalizeFiscalOwner(obligation303?.owner)),
      nextActionLabel: nextAction.label,
      nextActionHref: nextAction.href,
    })
  }

  if (input.model115Data.status === "ready") {
    const obligation115 = findObligation(input.obligations, "115", input.model115Data.period.periodKey)
    const effectiveStatus = resolveModel115Status(obligation115, input.model115Data.readiness)
    const nextAction = buildNextAction(effectiveStatus, "115", input.model115Data.period.periodKey)
    const readiness = buildModel115Readiness(effectiveStatus, input.model115Data.readiness)

    if (obligation115) {
      quarterlyWorkflowObligations.push(obligation115)
    }

    obligationsCockpit.push({
      code: "115",
      title: "Modelo 115",
      periodLabel: input.model115Data.period.periodKey,
      href: `/tax/forms/115?period=${input.model115Data.period.periodKey}`,
      statusLabel: getStatusLabel(effectiveStatus),
      statusVariant: getStatusVariant(effectiveStatus),
      dueDateLabel: resolveDueDateLabel("115", input.model115Data.period.periodKey, obligation115),
      readinessLabel: readiness.label,
      readinessVariant: readiness.variant,
      blockingItems: buildModel115BlockingItems(obligation115, input.model115Data.readiness, effectiveStatus),
      responsibleLabel: getResponsibleLabel(effectiveStatus, normalizeFiscalOwner(obligation115?.owner)),
      nextActionLabel: nextAction.label,
      nextActionHref: nextAction.href,
    })
  }

  if (input.model111Data.status === "ready") {
    const obligation111 = findObligation(input.obligations, "111_manual", input.model111Data.period.periodKey)
    const effectiveStatus = resolveModel111Status(obligation111, input.model111Data.manual.applies)
    const nextAction = buildNextAction(effectiveStatus, "111", input.model111Data.period.periodKey)
    const readiness = buildModel111Readiness(effectiveStatus, input.model111Data.manual.applies)

    if (obligation111) {
      quarterlyWorkflowObligations.push(obligation111)
    }

    obligationsCockpit.push({
      code: "111",
      title: "Modelo 111 manual",
      periodLabel: input.model111Data.period.periodKey,
      href: `/tax/forms/111?period=${input.model111Data.period.periodKey}`,
      statusLabel: getStatusLabel(effectiveStatus),
      statusVariant: getStatusVariant(effectiveStatus),
      dueDateLabel: resolveDueDateLabel("111", input.model111Data.period.periodKey, obligation111),
      readinessLabel: readiness.label,
      readinessVariant: readiness.variant,
      blockingItems: buildModel111BlockingItems(obligation111, input.model111Data.manual.applies, effectiveStatus),
      responsibleLabel: getResponsibleLabel(effectiveStatus, normalizeFiscalOwner(obligation111?.owner)),
      nextActionLabel: nextAction.label,
      nextActionHref: nextAction.href,
    })
  }

  return {
    obligations: obligationsCockpit,
    quarterlyWorkflowObligations,
  }
}

export async function getTaxWorkflowFiscalView(
  input: {
    organizationId: string
    userId: string
    ownerScopeId: string
    profile: TaxWorkflowProfile
  },
  dependencies: TaxWorkflowDependencies = {}
): Promise<TaxWorkflowFiscalView> {
  const loadTaxAttention = dependencies.getTaxAttention ?? getTaxAttention
  const loadModel303 = dependencies.loadModel303ForTenant ?? loadModel303ForTenant
  const loadModel115 = dependencies.loadModel115DraftForTenant ?? loadModel115DraftForTenant
  const loadModel111 = dependencies.loadModel111ManualForTenant ?? loadModel111ManualForTenant
  const loadCounterparties = dependencies.getCounterparties ?? getCounterparties
  const syncObligations = dependencies.syncFiscalObligationsForOrganization ?? syncFiscalObligationsForOrganization

  const [attention, model303Data, model115Data, model111Data, counterparties, syncedObligations] = await Promise.all([
    loadTaxAttention(input.ownerScopeId),
    loadModel303({ ownerScopeId: input.ownerScopeId }),
    loadModel115({ organizationId: input.organizationId, userId: input.userId }),
    loadModel111({ organizationId: input.organizationId, userId: input.userId }),
    loadCounterparties(input.ownerScopeId),
    syncObligations(input.organizationId),
  ])

  const fiscalYear = resolveAnnualHandoffFiscalYear({
    annualCloseMonth: input.profile.annualCloseMonth,
  })

  const obligations = syncedObligations as FiscalObligationDetail[]
  const workspaceView = buildProfileObligationsView({
    obligations,
    model303Data,
    model115Data,
    model111Data,
  })

  return {
    attention,
    obligations: workspaceView.obligations,
    annualOverview: buildAnnualOverview({
      fiscalYear,
      profile: input.profile,
      obligations,
      counterparties,
    }),
    workflow: buildWorkflowReadModelFromSlices({
      readiness: attention,
      items: buildFiscalWorkflowItems({
        obligations: workspaceView.quarterlyWorkflowObligations,
      }),
    }),
  }
}

export async function getLegacyTaxWorkspaceView(
  input: {
    organizationId: string
    userId: string
    ownerScopeId: string
    profile: TaxWorkflowProfile
  },
  dependencies: LegacyTaxWorkspaceDependencies = {}
): Promise<TaxLegacyWorkspaceView> {
  const loadTaxAttention = dependencies.getTaxAttention ?? getTaxAttention
  const loadModel303 = dependencies.loadModel303ForTenant ?? loadModel303ForTenant
  const loadModel115 = dependencies.loadModel115DraftForTenant ?? loadModel115DraftForTenant
  const loadModel111 = dependencies.loadModel111ManualForTenant ?? loadModel111ManualForTenant
  const loadCounterparties = dependencies.getCounterparties ?? getCounterparties
  const syncObligations = dependencies.syncFiscalObligationsForOrganization ?? syncFiscalObligationsForOrganization

  const [attention, model303Data, model115Data, model111Data, counterparties, syncedObligations] = await Promise.all([
    loadTaxAttention(input.ownerScopeId),
    loadModel303({ ownerScopeId: input.ownerScopeId }),
    loadModel115({ organizationId: input.organizationId, userId: input.userId }),
    loadModel111({ organizationId: input.organizationId, userId: input.userId }),
    loadCounterparties(input.ownerScopeId),
    syncObligations(input.organizationId),
  ])

  const fiscalYear = resolveAnnualHandoffFiscalYear({
    annualCloseMonth: input.profile.annualCloseMonth,
  })

  const obligations = syncedObligations as FiscalObligationDetail[]
  const workspaceView = buildProfileObligationsView({
    obligations,
    model303Data,
    model115Data,
    model111Data,
  })

  return {
    attention,
    obligations: workspaceView.obligations,
    annualOverview: buildAnnualOverview({
      fiscalYear,
      profile: input.profile,
      obligations,
      counterparties,
    }),
  }
}
