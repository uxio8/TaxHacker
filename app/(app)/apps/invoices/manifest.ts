import { createTranslator } from "@/lib/i18n"
import { AppManifest } from "../common"

const t = createTranslator()

export const manifest: AppManifest = {
  name: t("apps.invoices.title"),
  description: t("apps.invoices.description"),
  icon: "🧾",
}
