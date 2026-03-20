import LLMSettingsForm from "@/components/settings/llm-settings-form"
import { getCurrentUser } from "@/lib/auth"
import config from "@/lib/config"
import { isPoolCloudConfigured } from "@/lib/pool-cloud-env"
import { getFields } from "@/models/fields"
import { getSettings } from "@/models/settings"

export default async function LlmSettingsPage() {
  const user = await getCurrentUser()
  const settings = await getSettings(user.id)
  const fields = await getFields(user.id)
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
