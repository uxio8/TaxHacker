import LLMSettingsForm from "@/components/settings/llm-settings-form"
import config from "@/lib/config"
import { createPageMetadata } from "@/lib/i18n"
import { isPoolCloudConfigured } from "@/lib/pool-cloud-env"
import { requireCurrentOrganizationId } from "@/lib/tenant"
import { getFields } from "@/models/fields"
import { getSettings } from "@/models/settings"

export const metadata = createPageMetadata("settings.llm")

export default async function LlmSettingsPage() {
  const organizationId = await requireCurrentOrganizationId()
  const settings = await getSettings(organizationId)
  const fields = await getFields(organizationId)
  const isPoolCloudEnabled = isPoolCloudConfigured()

  return (
    <>
      <div className="w-full max-w-2xl">
        <LLMSettingsForm
          settings={settings}
          fields={fields}
          isPoolCloudEnabled={isPoolCloudEnabled}
          showApiKey={config.selfHosted.isEnabled}
        />
      </div>
    </>
  )
}
