import { AttentionCenter } from "@/components/dashboard/attention-center"
import DashboardDropZoneWidget from "@/components/dashboard/drop-zone-widget"
import { StatsWidget } from "@/components/dashboard/stats-widget"
import DashboardUnsortedWidget from "@/components/dashboard/unsorted-widget"
import { WelcomeWidget } from "@/components/dashboard/welcome-widget"
import { ReadinessChecklist } from "@/components/organization/readiness-checklist"
import { Separator } from "@/components/ui/separator"
import { getCurrentUser } from "@/lib/auth"
import { createPageMetadata } from "@/lib/i18n"
import { requireCurrentTenantProfile } from "@/lib/tenant"
import { getAttentionSummary } from "@/models/attention"
import { getUnsortedFiles } from "@/models/files"
import { getLLMSettings, getSettings } from "@/models/settings"
import { TransactionFilters } from "@/models/transactions"
import { buildUnsortedInboxItems } from "@/models/unsorted-inbox"

export const metadata = createPageMetadata("dashboard.title")

export default async function Dashboard({ searchParams }: { searchParams: Promise<TransactionFilters> }) {
  const filters = await searchParams
  const user = await getCurrentUser()
  const { organization: currentOrganization } = await requireCurrentTenantProfile({
    getCurrentUser: async () => user,
  })
  const organizationId = currentOrganization.id
  const unsortedFiles = await getUnsortedFiles(organizationId)
  const settings = await getSettings(organizationId)
  const llmSettings = getLLMSettings(settings)
  const hasConfiguredLlmProvider = llmSettings.providers.some(
    (provider) => provider.provider === "pool_cloud" || Boolean(provider.apiKey && provider.model)
  )
  const unsortedSummaries = buildUnsortedInboxItems(unsortedFiles, {
    llmConfigured: hasConfiguredLlmProvider,
  })
  const attention = await getAttentionSummary({
    organizationId,
    organizationName: currentOrganization.name,
    userId: user.id,
    businessAddress: user.businessAddress,
  })

  return (
    <div className="flex flex-col gap-5 p-5 w-full max-w-7xl self-center">
      {!attention.readiness.isReady ? <ReadinessChecklist summary={attention.readiness} /> : null}

      <AttentionCenter summary={attention} />

      <div className="flex flex-col sm:flex-row gap-5 items-stretch h-full">
        <DashboardDropZoneWidget />

        <DashboardUnsortedWidget files={unsortedFiles} summaries={unsortedSummaries} />
      </div>

      {settings.is_welcome_message_hidden !== "true" && <WelcomeWidget />}

      <Separator />

      <StatsWidget filters={filters} organizationId={organizationId} />
    </div>
  )
}
