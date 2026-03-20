"use client"
import { useState } from "react"
import { FormSelectCurrency } from "@/components/forms/select-currency"
import { FormInput } from "@/components/forms/simple"
import { Button } from "@/components/ui/button"
import { DEFAULT_CURRENCIES, DEFAULT_SETTINGS } from "@/models/defaults"
import { selfHostedGetStartedAction } from "../actions"

type Props = {
  requiresSetup: boolean
}

export default function SelfHostedSetupFormClient({ requiresSetup }: Props) {
  const [defaultCurrency, setDefaultCurrency] = useState(
    DEFAULT_SETTINGS.find((setting) => setting.code === "default_currency")?.value ?? "EUR"
  )

  return (
    <form action={selfHostedGetStartedAction} className="flex flex-col gap-8 pt-8">
      <FormInput
        title="Admin Token"
        name="self_hosted_admin_token"
        type="password"
        autoComplete="current-password"
        required
        placeholder="Enter your self-hosted admin token"
      />
      {requiresSetup ? (
        <div className="flex flex-row gap-4 items-center justify-center">
          <FormSelectCurrency
            title="Base Currency"
            name="default_currency"
            value={defaultCurrency}
            onValueChange={setDefaultCurrency}
            currencies={DEFAULT_CURRENCIES}
          />
        </div>
      ) : null}
      {requiresSetup ? (
        <p className="max-w-md text-center text-sm text-muted-foreground">
          AI providers are configured afterwards from Settings. Environment-managed providers like Pool Cloud do not
          ask for secrets here.
        </p>
      ) : null}
      <Button type="submit" className="w-auto p-6">
        {requiresSetup ? "Unlock and Get Started" : "Unlock Instance"}
      </Button>
    </form>
  )
}
