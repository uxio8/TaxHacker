"use client"

import { saveCounterpartyAction } from "@/app/(app)/tax/counterparties/actions"
import { FormError } from "@/components/forms/error"
import { FormInput } from "@/components/forms/simple"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { COUNTERPARTY_FORM_DEFAULTS } from "@/forms/fiscal/counterparties"
import { useI18n } from "@/lib/i18n"
import type { Counterparty } from "@/prisma/client"
import { CircleCheckBig } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useActionState, useEffect, useRef } from "react"

export function CounterpartyForm({ counterparty }: { counterparty: Counterparty | null }) {
  const { t } = useI18n()
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [saveState, saveAction, pending] = useActionState(saveCounterpartyAction, null)
  const isEditing = Boolean(counterparty)
  const taxIdLocked = Boolean(counterparty?.taxId)
  const displayNameLocked = isEditing && !counterparty?.taxId

  useEffect(() => {
    if (!saveState?.success) {
      return
    }

    if (!isEditing) {
      formRef.current?.reset()
    }

    router.refresh()
  }, [isEditing, router, saveState])

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>
          {isEditing
            ? t("settings.crud.editItem", { item: t("tax.counterparties.singular") })
            : t("tax.counterparties.form.createTitle")}
        </CardTitle>
        <CardDescription>
          {isEditing ? t("tax.counterparties.form.editDescription") : t("tax.counterparties.form.createDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={saveAction} className="space-y-4">
          <input type="hidden" name="counterpartyId" value={counterparty?.id ?? ""} />
          <input type="hidden" name="countryCode" value={COUNTERPARTY_FORM_DEFAULTS.countryCode} />
          <input type="hidden" name="isActive" value="false" />

          <FormInput
            title={t("tax.counterparties.fields.displayName")}
            name="displayName"
            placeholder={t("tax.counterparties.form.displayNamePlaceholder")}
            defaultValue={counterparty?.displayName ?? ""}
            readOnly={displayNameLocked}
          />

          <FormInput
            title={t("tax.counterparties.fields.taxId")}
            name="taxId"
            placeholder={t("tax.counterparties.form.taxIdPlaceholder")}
            defaultValue={counterparty?.taxId ?? ""}
            readOnly={taxIdLocked}
          />

          <FormInput
            title={t("tax.counterparties.fields.countryCode")}
            value={COUNTERPARTY_FORM_DEFAULTS.countryCode}
            readOnly
            disabled
          />

          <label className="flex items-center gap-3 rounded-lg border p-3">
            <input
              type="checkbox"
              name="isActive"
              value="true"
              defaultChecked={counterparty?.isActive ?? COUNTERPARTY_FORM_DEFAULTS.isActive}
              className="h-4 w-4"
            />
            <span className="text-sm font-medium">{t("tax.counterparties.fields.isActive")}</span>
          </label>

          {(taxIdLocked || displayNameLocked) && (
            <p className="text-sm text-muted-foreground">{t("tax.counterparties.form.identityHint")}</p>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" disabled={pending}>
              {pending ? t("settings.feedback.saving") : t("common.actions.save")}
            </Button>

            {isEditing && (
              <Button asChild variant="outline">
                <Link href="/tax/counterparties">{t("tax.counterparties.form.createAnother")}</Link>
              </Button>
            )}

            {saveState?.success && (
              <p className="flex items-center gap-2 text-green-600">
                <CircleCheckBig className="h-4 w-4" />
                {t("settings.feedback.saved")}
              </p>
            )}
          </div>

          {saveState?.error && <FormError>{saveState.error}</FormError>}
        </form>
      </CardContent>
    </Card>
  )
}
