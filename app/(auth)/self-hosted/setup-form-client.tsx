"use client"
import { useState } from "react"
import { FormSelectCurrency } from "@/components/forms/select-currency"
import { FormInput } from "@/components/forms/simple"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"
import { selfHostedGetStartedAction } from "../actions"

type Props = {
  requiresSetup: boolean
  defaultCurrency: string
  currencies: Array<{ code: string; name: string }>
}

export default function SelfHostedSetupFormClient({
  requiresSetup,
  defaultCurrency: initialDefaultCurrency,
  currencies,
}: Props) {
  const { t } = useI18n()
  const [defaultCurrency, setDefaultCurrency] = useState(initialDefaultCurrency)

  return (
    <form action={selfHostedGetStartedAction} className="flex flex-col gap-8 pt-8">
      <FormInput
        title={t("auth.selfHosted.adminToken")}
        name="self_hosted_admin_token"
        type="password"
        autoComplete="current-password"
        required
        placeholder={t("auth.selfHosted.adminTokenPlaceholder")}
      />
      {requiresSetup ? (
        <div className="flex flex-row gap-4 items-center justify-center">
          <FormSelectCurrency
            title={t("auth.selfHosted.baseCurrency")}
            name="default_currency"
            value={defaultCurrency}
            onValueChange={setDefaultCurrency}
            currencies={currencies}
          />
        </div>
      ) : null}
      {requiresSetup ? (
        <p className="max-w-md text-center text-sm text-muted-foreground">
          {t("auth.selfHosted.providersHint")}
        </p>
      ) : null}
      <Button type="submit" className="w-auto p-6">
        {requiresSetup ? t("auth.selfHosted.unlockAndStart") : t("auth.selfHosted.unlockInstance")}
      </Button>
    </form>
  )
}
