import { FiscalStorageNotReady } from "@/components/tax/fiscal-storage-not-ready"
import { TaxWorkspaceHeader } from "@/components/tax/layout/tax-workspace-header"
import { TaxWorkspaceSections } from "@/components/tax/layout/tax-workspace-sections"
import { getCurrentUser } from "@/lib/auth"
import config from "@/lib/config"
import { createPageMetadata, createTranslator } from "@/lib/i18n"
import { requireCurrentOrganizationId } from "@/lib/tenant"
import { getFiscalProfileAccessByOrganizationId } from "@/models/fiscal/profile"
import { isFiscalStorageNotReadyError } from "@/models/fiscal/storage"
import {
  getLegacyTaxWorkspaceView,
  getTaxWorkflowFiscalView,
  type TaxWorkflowProfile,
} from "@/models/workflow/fiscal-read-api"

export const metadata = createPageMetadata("tax.title", {
  descriptionKey: "tax.description",
})

function buildTaxWorkflowProfile(input: {
  organizationId: string
  profile: {
    annualCloseMonth: number
    companyName: string
    hasEmployees: boolean
    hasIntraEuOperations: boolean
    hasProfessionalWithholding: boolean
    hasRentWithholding: boolean
    issuesInvoices: boolean
    taxId: string
  }
}): TaxWorkflowProfile {
  return {
    annualCloseMonth: input.profile.annualCloseMonth,
    companyName: input.profile.companyName,
    hasEmployees: input.profile.hasEmployees,
    hasIntraEuOperations: input.profile.hasIntraEuOperations,
    hasProfessionalWithholding: input.profile.hasProfessionalWithholding,
    hasRentWithholding: input.profile.hasRentWithholding,
    issuesInvoices: input.profile.issuesInvoices,
    organizationId: input.organizationId,
    taxId: input.profile.taxId,
  }
}

function renderStorageNotReadyState(input: {
  t: ReturnType<typeof createTranslator>
  companyName: string | null
  companyTaxId: string | null
}) {
  return (
    <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
      <TaxWorkspaceHeader
        t={input.t}
        attention={null}
        companyName={input.companyName}
        companyTaxId={input.companyTaxId}
      />
      <FiscalStorageNotReady t={input.t} />
    </main>
  )
}

export default async function TaxPage() {
  const t = createTranslator()
  const user = await getCurrentUser()
  const organizationId = await requireCurrentOrganizationId({
    getCurrentUser: async () => user,
  })
  const fiscalProfileAccess = await getFiscalProfileAccessByOrganizationId(organizationId, user.id)

  if (fiscalProfileAccess.status === "storage_not_ready") {
    return renderStorageNotReadyState({
      t,
      companyName: null,
      companyTaxId: null,
    })
  }

  if (fiscalProfileAccess.status !== "ready") {
    return (
      <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
        <TaxWorkspaceHeader t={t} attention={null} companyName={null} companyTaxId={null} />
        <TaxWorkspaceSections t={t} attention={null} setupHref="/settings/fiscal" />
      </main>
    )
  }

  const profile = buildTaxWorkflowProfile({
    organizationId,
    profile: fiscalProfileAccess.profile,
  })

  try {
    const fiscalView = config.workflow.fiscalSliceEnabled
      ? await getTaxWorkflowFiscalView({
          organizationId,
          userId: user.id,
          ownerScopeId: fiscalProfileAccess.profile.id,
          profile,
        })
      : await getLegacyTaxWorkspaceView({
          organizationId,
          userId: user.id,
          ownerScopeId: fiscalProfileAccess.profile.id,
          profile,
        })

    return (
      <main className="flex w-full max-w-7xl self-center flex-col gap-6 p-5">
        <TaxWorkspaceHeader
          t={t}
          attention={fiscalView.attention}
          companyName={fiscalProfileAccess.profile.companyName}
          companyTaxId={fiscalProfileAccess.profile.taxId}
        />
        <TaxWorkspaceSections
          t={t}
          attention={fiscalView.attention}
          obligations={fiscalView.obligations}
          annualOverview={fiscalView.annualOverview}
        />
      </main>
    )
  } catch (error) {
    if (isFiscalStorageNotReadyError(error)) {
      return renderStorageNotReadyState({
        t,
        companyName: fiscalProfileAccess.profile.companyName,
        companyTaxId: fiscalProfileAccess.profile.taxId,
      })
    }

    throw error
  }
}
