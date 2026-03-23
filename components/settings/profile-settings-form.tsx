"use client"

import { saveProfileAction } from "@/app/(app)/settings/actions"
import { FormError } from "@/components/forms/error"
import { FormAvatar, FormInput } from "@/components/forms/simple"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"
import { User } from "@/prisma/client"
import { CircleCheckBig } from "lucide-react"
import { useActionState } from "react"
import { SubscriptionPlan } from "./subscription-plan"

type BillingProjection = {
  membershipPlan: string
  membershipExpiresAt: Date | null
  stripeCustomerId?: string | null
  storageLimit: number
  storageUsed: number
  aiBalance: number
}

export default function ProfileSettingsForm({ user, billing }: { user: User; billing: BillingProjection }) {
  const { t } = useI18n()
  const [saveState, saveAction, pending] = useActionState(saveProfileAction, null)

  return (
    <div>
      <form action={saveAction} className="space-y-4">
        <FormAvatar
          title={t("settings.profile.avatar")}
          name="avatar"
          className="w-24 h-24"
          defaultValue={user.avatar ? user.avatar + "?" + user.id : ""}
        />

        <FormInput title={t("settings.profile.name")} name="name" defaultValue={user.name || ""} />

        <div className="flex flex-row items-center gap-4">
          <Button type="submit" disabled={pending}>
            {pending ? t("settings.feedback.saving") : t("common.actions.save")}
          </Button>
          {saveState?.success && (
            <p className="text-green-500 flex flex-row items-center gap-2">
              <CircleCheckBig />
              {t("settings.feedback.saved")}
            </p>
          )}
        </div>

        {saveState?.error && <FormError>{saveState.error}</FormError>}
      </form>

      <div className="mt-10">
        <SubscriptionPlan billing={billing} />
      </div>
    </div>
  )
}
