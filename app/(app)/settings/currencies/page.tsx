import { addCurrencyAction, deleteCurrencyAction, editCurrencyAction } from "@/app/(app)/settings/actions"
import { CrudTable } from "@/components/settings/crud"
import { getCurrentUser } from "@/lib/auth"
import { createTranslator } from "@/lib/i18n"
import { getCurrencies } from "@/models/currencies"

export default async function CurrenciesSettingsPage() {
  const t = createTranslator()
  const user = await getCurrentUser()
  const currencies = await getCurrencies(user.id)
  const currenciesWithActions = currencies.map((currency) => ({
    ...currency,
    isEditable: true,
    isDeletable: true,
  }))

  return (
    <div className="container">
      <h1 className="text-2xl font-bold mb-2">{t("settings.currencies.title")}</h1>
      <p className="text-sm text-gray-500 mb-6 max-w-prose">{t("settings.currencies.description")}</p>
      <CrudTable
        items={currenciesWithActions}
        columns={[
          { key: "code", label: t("settings.columns.code"), editable: true },
          { key: "name", label: t("settings.columns.name"), editable: true },
        ]}
        onDelete={async (code) => {
          "use server"
          return await deleteCurrencyAction(user.id, code)
        }}
        onAdd={async (data) => {
          "use server"
          return await addCurrencyAction(user.id, data as { code: string; name: string })
        }}
        onEdit={async (code, data) => {
          "use server"
          return await editCurrencyAction(user.id, code, data as { name: string })
        }}
      />
    </div>
  )
}
