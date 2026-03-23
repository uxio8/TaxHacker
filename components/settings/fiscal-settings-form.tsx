"use client"

import { saveFiscalProfileAction } from "@/app/(app)/settings/actions"
import { FormError } from "@/components/forms/error"
import { FormInput } from "@/components/forms/simple"
import { Button } from "@/components/ui/button"
import { FISCAL_PROFILE_FORM_DEFAULTS } from "@/forms/fiscal/profile"
import { useI18n } from "@/lib/i18n"
import type { FiscalProfile } from "@/prisma/client"
import { CircleCheckBig } from "lucide-react"
import { useActionState } from "react"

export default function FiscalSettingsForm({ profile }: { profile: FiscalProfile | null }) {
  const { t } = useI18n()
  const [saveState, saveAction, pending] = useActionState(saveFiscalProfileAction, null)

  return (
    <form action={saveAction} className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{t("settings.fiscal.description")}</p>
        <p className="text-sm text-muted-foreground">{t("settings.fiscal.scopeHint")}</p>
      </div>

      <FormInput
        title={t("settings.fiscal.companyName")}
        name="companyName"
        placeholder={t("settings.fiscal.companyNamePlaceholder")}
        defaultValue={profile?.companyName ?? ""}
      />

      <FormInput
        title={t("settings.fiscal.taxId")}
        name="taxId"
        placeholder={t("settings.fiscal.taxIdPlaceholder")}
        defaultValue={profile?.taxId ?? ""}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <FormInput
          title={t("settings.fiscal.countryCode")}
          value={FISCAL_PROFILE_FORM_DEFAULTS.countryCode}
          readOnly
          disabled
        />

        <FormInput
          title={t("settings.fiscal.currencyCode")}
          value={FISCAL_PROFILE_FORM_DEFAULTS.currencyCode}
          readOnly
          disabled
        />

        <FormInput
          title={t("settings.fiscal.legalEntityType")}
          value={t("settings.fiscal.legalEntityTypeValue")}
          readOnly
          disabled
        />
      </div>

      <input type="hidden" name="countryCode" value={FISCAL_PROFILE_FORM_DEFAULTS.countryCode} />
      <input type="hidden" name="currencyCode" value={FISCAL_PROFILE_FORM_DEFAULTS.currencyCode} />
      <input type="hidden" name="legalEntityType" value={FISCAL_PROFILE_FORM_DEFAULTS.legalEntityType} />
      <input type="hidden" name="vatCashAccountingEnabled" value="false" />
      <input type="hidden" name="hasEmployees" value="false" />
      <input type="hidden" name="hasRentWithholding" value="false" />
      <input type="hidden" name="hasProfessionalWithholding" value="false" />
      <input type="hidden" name="hasIntraEuOperations" value="false" />
      <input type="hidden" name="issuesInvoices" value="false" />

      <label className="flex items-start gap-3 rounded-lg border p-3">
        <input
          type="checkbox"
          name="vatCashAccountingEnabled"
          value="true"
          defaultChecked={profile?.vatCashAccountingEnabled ?? false}
          className="mt-1 h-4 w-4"
        />
        <span className="space-y-1">
          <span className="block text-sm font-medium">{t("settings.fiscal.vatCashAccountingEnabled")}</span>
          <span className="block text-sm text-muted-foreground">
            {t("settings.fiscal.vatCashAccountingEnabledHint")}
          </span>
        </span>
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex items-start gap-3 rounded-lg border p-3">
          <input
            type="checkbox"
            name="hasEmployees"
            value="true"
            defaultChecked={profile?.hasEmployees ?? false}
            className="mt-1 h-4 w-4"
          />
          <span className="space-y-1">
            <span className="block text-sm font-medium">{t("settings.fiscal.hasEmployees")}</span>
            <span className="block text-sm text-muted-foreground">
              {t("settings.fiscal.hasEmployeesHint")}
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 rounded-lg border p-3">
          <input
            type="checkbox"
            name="hasRentWithholding"
            value="true"
            defaultChecked={profile?.hasRentWithholding ?? false}
            className="mt-1 h-4 w-4"
          />
          <span className="space-y-1">
            <span className="block text-sm font-medium">{t("settings.fiscal.hasRentWithholding")}</span>
            <span className="block text-sm text-muted-foreground">
              {t("settings.fiscal.hasRentWithholdingHint")}
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 rounded-lg border p-3">
          <input
            type="checkbox"
            name="hasProfessionalWithholding"
            value="true"
            defaultChecked={profile?.hasProfessionalWithholding ?? false}
            className="mt-1 h-4 w-4"
          />
          <span className="space-y-1">
            <span className="block text-sm font-medium">
              {t("settings.fiscal.hasProfessionalWithholding")}
            </span>
            <span className="block text-sm text-muted-foreground">
              {t("settings.fiscal.hasProfessionalWithholdingHint")}
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 rounded-lg border p-3">
          <input
            type="checkbox"
            name="hasIntraEuOperations"
            value="true"
            defaultChecked={profile?.hasIntraEuOperations ?? false}
            className="mt-1 h-4 w-4"
          />
          <span className="space-y-1">
            <span className="block text-sm font-medium">
              {t("settings.fiscal.hasIntraEuOperations")}
            </span>
            <span className="block text-sm text-muted-foreground">
              {t("settings.fiscal.hasIntraEuOperationsHint")}
            </span>
          </span>
        </label>
      </div>

      <label className="flex items-start gap-3 rounded-lg border p-3">
        <input
          type="checkbox"
          name="issuesInvoices"
          value="true"
          defaultChecked={profile?.issuesInvoices ?? true}
          className="mt-1 h-4 w-4"
        />
        <span className="space-y-1">
          <span className="block text-sm font-medium">{t("settings.fiscal.issuesInvoices")}</span>
          <span className="block text-sm text-muted-foreground">
            {t("settings.fiscal.issuesInvoicesHint")}
          </span>
        </span>
      </label>

      <FormInput
        title={t("settings.fiscal.annualCloseMonth")}
        name="annualCloseMonth"
        type="number"
        min={1}
        max={12}
        placeholder="12"
        defaultValue={String(profile?.annualCloseMonth ?? 12)}
      />

      <div className="flex flex-row items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? t("settings.feedback.saving") : t("common.actions.save")}
        </Button>
        {saveState?.success && (
          <p className="flex flex-row items-center gap-2 text-green-500">
            <CircleCheckBig />
            {t("settings.feedback.saved")}
          </p>
        )}
      </div>

      {saveState?.error && <FormError>{saveState.error}</FormError>}
    </form>
  )
}
