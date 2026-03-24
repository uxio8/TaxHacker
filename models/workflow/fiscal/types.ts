import type { TaxAttention } from "../../tax-attention.ts"
import type { WorkflowReadModel } from "../contracts.ts"

type BadgeVariant = "default" | "secondary" | "outline"

export type QuarterlyCockpitCode = "303" | "115" | "111"
export type AnnualCockpitCode = "180" | "390" | "347" | "349"
export type TaxWorkflowProfile = {
  organizationId: string
  companyName: string
  taxId: string
  annualCloseMonth: number
  issuesInvoices: boolean
  hasRentWithholding: boolean
  hasIntraEuOperations: boolean
  hasEmployees: boolean
  hasProfessionalWithholding: boolean
}

export type TaxWorkflowObligationItem = {
  code: string
  title: string
  periodLabel: string
  href: string
  statusLabel: string
  statusVariant: BadgeVariant
  dueDateLabel: string
  readinessLabel: string
  readinessVariant: BadgeVariant
  blockingItems: string[]
  responsibleLabel: string
  nextActionLabel: string
  nextActionHref: string
}

export type TaxWorkflowAnnualOverviewItem = {
  code: string
  title: string
  description: string
  href: string
  dueDateLabel: string
  statusLabel: string
  statusVariant: BadgeVariant
  responsibleLabel: string
  nextActionLabel: string
  nextActionHref: string
  operationalNote: string
}

export type TaxWorkflowAnnualOverview = {
  fiscalYear: number
  items: TaxWorkflowAnnualOverviewItem[]
  handoffHref: string
  handoffSummary: string
}

export type TaxWorkflowFiscalView = {
  attention: TaxAttention
  obligations: TaxWorkflowObligationItem[]
  annualOverview: TaxWorkflowAnnualOverview
  workflow: WorkflowReadModel<TaxAttention>
}

export type TaxLegacyWorkspaceView = {
  attention: TaxAttention
  obligations: TaxWorkflowObligationItem[]
  annualOverview: TaxWorkflowAnnualOverview
}

export type TaxArchiveWorkflowView = {
  periods: unknown[]
}

export type TaxArchivePeriodWorkflowView = {
  detail: unknown | null
}

export type AnnualArchiveWorkflowView = {
  fiscalYear: number
  pack: unknown
}
