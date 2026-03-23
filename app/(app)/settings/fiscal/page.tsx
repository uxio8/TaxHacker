import FiscalSettingsForm from "@/components/settings/fiscal-settings-form"
import { FiscalStorageNotReady } from "@/components/tax/fiscal-storage-not-ready"
import { getCurrentUser } from "@/lib/auth"
import { createPageMetadata, createTranslator } from "@/lib/i18n"
import { requireCurrentOrganizationId } from "@/lib/tenant"
import { getFiscalProfileAccessByOrganizationId } from "@/models/fiscal/profile"

export const metadata = createPageMetadata("settings.fiscal.title")

export default async function FiscalSettingsPage() {
  const t = createTranslator()
  const user = await getCurrentUser()
  const organizationId = await requireCurrentOrganizationId({
    getCurrentUser: async () => user,
  })
  const fiscalProfileAccess = await getFiscalProfileAccessByOrganizationId(organizationId, user.id)

  if (fiscalProfileAccess.status === "storage_not_ready") {
    return (
      <div className="w-full max-w-2xl">
        <FiscalStorageNotReady t={t} />
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl">
      <FiscalSettingsForm
        profile={fiscalProfileAccess.status === "ready" ? fiscalProfileAccess.profile : null}
      />
    </div>
  )
}
