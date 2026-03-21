"use client"

import { saveSettingsAction } from "@/app/(app)/settings/actions"
import { FormError } from "@/components/forms/error"
import { FormSelectCategory } from "@/components/forms/select-category"
import { FormSelectCurrency } from "@/components/forms/select-currency"
import { FormSelectType } from "@/components/forms/select-type"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"
import { Category, Currency } from "@/prisma/client"
import { CircleCheckBig } from "lucide-react"
import { useActionState } from "react"

export default function GlobalSettingsForm({
  settings,
  currencies,
  categories,
}: {
  settings: Record<string, string>
  currencies: Currency[]
  categories: Category[]
}) {
  const { t } = useI18n()
  const [saveState, saveAction, pending] = useActionState(saveSettingsAction, null)

  return (
    <form action={saveAction} className="space-y-4">
      <FormSelectCurrency
        title={t("settings.general.defaultCurrency")}
        name="default_currency"
        defaultValue={settings.default_currency}
        currencies={currencies}
      />

      <FormSelectType title={t("settings.general.defaultType")} name="default_type" defaultValue={settings.default_type} />

      <FormSelectCategory
        title={t("settings.general.defaultCategory")}
        name="default_category"
        defaultValue={settings.default_category}
        categories={categories}
      />

      <div className="flex flex-row items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? t("settings.feedback.saving") : t("settings.general.saveSettings")}
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
  )
}
