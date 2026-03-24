import type { AnnualHandoffPack } from "../../../models/fiscal/annual-handoff.ts"
import type {
  LegalArchivePeriodDetail,
  LegalArchivePeriodListItem,
} from "../../../models/fiscal/legal-archive.ts"
import type {
  AnnualArchiveWorkflowView,
  TaxArchivePeriodWorkflowView,
  TaxArchiveWorkflowView,
} from "../../../models/workflow/fiscal-read-api.ts"

const taxArchiveWorkflowView: TaxArchiveWorkflowView = {
  periods: [] as LegalArchivePeriodListItem[],
}

const taxArchivePeriodWorkflowView: TaxArchivePeriodWorkflowView = {
  detail: null as LegalArchivePeriodDetail | null,
}

const annualArchiveWorkflowView: AnnualArchiveWorkflowView = {
  fiscalYear: 2026,
  pack: {} as AnnualHandoffPack,
}

void taxArchiveWorkflowView
void taxArchivePeriodWorkflowView
void annualArchiveWorkflowView
