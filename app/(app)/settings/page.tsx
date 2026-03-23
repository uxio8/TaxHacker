import { ReadinessChecklist } from "@/components/organization/readiness-checklist"
import { getCurrentUser } from "@/lib/auth"
import GlobalSettingsForm from "@/components/settings/global-settings-form"
import { createPageMetadata } from "@/lib/i18n"
import { requireCurrentTenantProfile } from "@/lib/tenant"
import { getAttentionSummary } from "@/models/attention"
import { getCategories } from "@/models/categories"
import { getCurrencies } from "@/models/currencies"
import { getSettings } from "@/models/settings"

export const metadata = createPageMetadata("settings.general")

export default async function SettingsPage() {
  const user = await getCurrentUser()
  const { organization } = await requireCurrentTenantProfile({
    getCurrentUser: async () => user,
  })
  const organizationId = organization.id
  const settings = await getSettings(organizationId)
  const currencies = await getCurrencies(organizationId)
  const categories = await getCategories(organizationId)
  const attention = await getAttentionSummary({
    organizationId,
    organizationName: organization.name,
    userId: user.id,
    businessAddress: user.businessAddress,
  })

  return (
    <div className="flex w-full flex-col gap-6">
      {!attention.readiness.isReady ? (
        <ReadinessChecklist
          summary={attention.readiness}
          title="Completa la puesta en marcha"
          description="Desde aquí puedes dejar empresa, IA, fiscal y backup básico bien cerrados antes de operar a diario."
        />
      ) : null}

      <div className="w-full max-w-2xl">
        <GlobalSettingsForm settings={settings} currencies={currencies} categories={categories} />
      </div>
    </div>
  )
}
