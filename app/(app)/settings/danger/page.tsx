import { Button } from "@/components/ui/button"
import { getCurrentUser } from "@/lib/auth"
import { createTranslator } from "@/lib/i18n"
import { resetFieldsAndCategories, resetLLMSettings } from "./actions"

export default async function DangerSettingsPage() {
  const t = createTranslator()
  const user = await getCurrentUser()

  return (
    <div className="container">
      <h1 className="text-2xl font-bold mb-2 text-red-500">{t("settings.danger.title")}</h1>
      <p className="text-sm text-red-400 mb-8 max-w-prose">{t("settings.danger.description")}</p>
      <div className="space-y-10">
        <div className="space-y-2">
          <h3 className="text-lg font-bold">{t("settings.danger.llm.title")}</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-prose">{t("settings.danger.llm.description")}</p>
          <form
            action={async () => {
              "use server"
              await resetLLMSettings(user)
            }}
          >
            <Button variant="destructive" type="submit">
              {t("settings.danger.llm.action")}
            </Button>
          </form>
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-bold">{t("settings.danger.data.title")}</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-prose">{t("settings.danger.data.description")}</p>
          <form
            action={async () => {
              "use server"
              await resetFieldsAndCategories(user)
            }}
          >
            <Button variant="destructive" type="submit">
              {t("settings.danger.data.action")}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
