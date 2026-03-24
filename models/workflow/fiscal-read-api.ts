// Stable public fiscal workflow facade. Keep external imports pointed here while
// the internal implementation is split into smaller modules.

export type {
  AnnualArchiveWorkflowView,
  TaxArchivePeriodWorkflowView,
  TaxArchiveWorkflowView,
  TaxLegacyWorkspaceView,
  TaxWorkflowAnnualOverview,
  TaxWorkflowAnnualOverviewItem,
  TaxWorkflowFiscalView,
  TaxWorkflowObligationItem,
  TaxWorkflowProfile,
} from "./fiscal/types.ts"

export {
  getAnnualArchiveWorkflowView,
  getTaxArchivePeriodWorkflowView,
  getTaxArchiveWorkflowView,
} from "./fiscal/archive-views.ts"

export {
  getLegacyTaxWorkspaceView,
  getTaxWorkflowFiscalView,
} from "./fiscal/workspace-view.ts"
