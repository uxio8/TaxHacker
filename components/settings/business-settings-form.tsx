"use client"

import { saveProfileAction } from "@/app/(app)/settings/actions"
import { FormError } from "@/components/forms/error"
import { FormAvatar, FormInput, FormTextarea } from "@/components/forms/simple"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"
import { User } from "@/prisma/client"
import { CircleCheckBig } from "lucide-react"
import { useActionState } from "react"

export default function BusinessSettingsForm({ user }: { user: User }) {
  const { t } = useI18n()
  const [saveState, saveAction, pending] = useActionState(saveProfileAction, null)

  return (
    <div>
      <form action={saveAction} className="space-y-4">
        <FormInput
          title={t("settings.business.name")}
          name="businessName"
          placeholder="Acme Inc."
          defaultValue={user.businessName ?? ""}
        />

        <FormTextarea
          title={t("settings.business.address")}
          name="businessAddress"
          placeholder={t("settings.business.addressPlaceholder")}
          defaultValue={user.businessAddress ?? ""}
        />

        <FormTextarea
          title={t("settings.business.bankDetails")}
          name="businessBankDetails"
          placeholder={t("settings.business.bankDetailsPlaceholder")}
          defaultValue={user.businessBankDetails ?? ""}
        />

        <FormAvatar
          title={t("settings.business.logo")}
          name="businessLogo"
          className="w-52 h-52"
          defaultValue={user.businessLogo ?? ""}
        />

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
    </div>
  )
}
