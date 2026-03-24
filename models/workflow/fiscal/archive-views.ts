import {
  buildAnnualHandoffPack,
  getAnnualHandoffPackForOrganization,
  resolveAnnualHandoffFiscalYear,
} from "../../fiscal/annual-handoff.ts"
import {
  getLegalArchivePeriodDetail,
  listLegalArchivePeriods,
  type LegalArchivePeriodDetail,
  type LegalArchivePeriodListItem,
} from "../../fiscal/legal-archive.ts"
import { syncDefaultSpanishFiscalPeriodsV1 } from "../../fiscal/periods.ts"
import type {
  AnnualArchiveWorkflowView,
  TaxArchivePeriodWorkflowView,
  TaxArchiveWorkflowView,
  TaxWorkflowProfile,
} from "./types.ts"

type TaxArchiveDependencies = {
  syncDefaultSpanishFiscalPeriodsV1?: typeof syncDefaultSpanishFiscalPeriodsV1
  listLegalArchivePeriods?: typeof listLegalArchivePeriods
  getLegalArchivePeriodDetail?: typeof getLegalArchivePeriodDetail
}

type AnnualArchiveDependencies = {
  getAnnualHandoffPackForOrganization?: typeof getAnnualHandoffPackForOrganization
}

export async function getTaxArchiveWorkflowView(
  input: {
    organizationId: string
    ownerScopeId: string
  },
  dependencies: TaxArchiveDependencies = {}
): Promise<TaxArchiveWorkflowView & { periods: LegalArchivePeriodListItem[] }> {
  const syncPeriods = dependencies.syncDefaultSpanishFiscalPeriodsV1 ?? syncDefaultSpanishFiscalPeriodsV1
  const listPeriods = dependencies.listLegalArchivePeriods ?? listLegalArchivePeriods

  await syncPeriods(input.ownerScopeId)

  return {
    periods: await listPeriods(input.ownerScopeId, input.organizationId),
  }
}

export async function getTaxArchivePeriodWorkflowView(
  input: {
    organizationId: string
    ownerScopeId: string
    periodKey: string
  },
  dependencies: TaxArchiveDependencies = {}
): Promise<TaxArchivePeriodWorkflowView & { detail: LegalArchivePeriodDetail | null }> {
  const syncPeriods = dependencies.syncDefaultSpanishFiscalPeriodsV1 ?? syncDefaultSpanishFiscalPeriodsV1
  const loadDetail = dependencies.getLegalArchivePeriodDetail ?? getLegalArchivePeriodDetail

  await syncPeriods(input.ownerScopeId)

  return {
    detail: await loadDetail(input.ownerScopeId, input.organizationId, input.periodKey),
  }
}

export async function getAnnualArchiveWorkflowView(
  input: {
    organizationId: string
    profile: TaxWorkflowProfile
  },
  dependencies: AnnualArchiveDependencies = {}
): Promise<AnnualArchiveWorkflowView & { pack: Awaited<ReturnType<typeof buildAnnualHandoffPack>> }> {
  const loadAnnualHandoffPack = dependencies.getAnnualHandoffPackForOrganization ?? getAnnualHandoffPackForOrganization
  const fiscalYear = resolveAnnualHandoffFiscalYear({
    annualCloseMonth: input.profile.annualCloseMonth,
  })

  return {
    fiscalYear,
    pack: await loadAnnualHandoffPack({
      organizationId: input.organizationId,
      profile: {
        annualCloseMonth: input.profile.annualCloseMonth,
        companyName: input.profile.companyName,
        organizationId: input.profile.organizationId,
        taxId: input.profile.taxId,
      },
      fiscalYear,
    }),
  }
}
