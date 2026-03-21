import ProfileSettingsForm from "@/components/settings/profile-settings-form"
import { getCurrentUser } from "@/lib/auth"
import { createPageMetadata } from "@/lib/i18n"

export const metadata = createPageMetadata("settings.profileAndPlan")

export default async function ProfileSettingsPage() {
  const user = await getCurrentUser()

  return (
    <>
      <div className="w-full max-w-2xl">
        <ProfileSettingsForm user={user} />
      </div>
    </>
  )
}
