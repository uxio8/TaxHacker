import { SideNav } from "@/components/settings/side-nav"
import { Separator } from "@/components/ui/separator"
import { createTranslator } from "@/lib/i18n"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Ajustes",
  description: "Personaliza aquí tus ajustes",
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const t = createTranslator()
  const settingsCategories = [
    { title: t("settings.general"), href: "/settings" },
    { title: t("settings.profileAndPlan"), href: "/settings/profile" },
    { title: t("settings.businessDetails"), href: "/settings/business" },
    { title: t("settings.llm"), href: "/settings/llm" },
    { title: t("common.fields"), href: "/settings/fields" },
    { title: t("common.categories"), href: "/settings/categories" },
    { title: t("common.projects"), href: "/settings/projects" },
    { title: t("settings.currencies"), href: "/settings/currencies" },
    { title: t("settings.backups"), href: "/settings/backups" },
    { title: t("settings.dangerZone"), href: "/settings/danger" },
  ]

  return (
    <>
      <div className="space-y-6 p-10 pb-16">
        <div className="space-y-0.5">
          <h2 className="text-2xl font-bold tracking-tight">{t("settings.title")}</h2>
          <p className="text-muted-foreground">{t("settings.description")}</p>
        </div>
        <Separator className="my-6" />
        <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
          <aside className="-mx-4 lg:w-1/5">
            <SideNav items={settingsCategories} />
          </aside>
          <div className="flex w-full">{children}</div>
        </div>
      </div>
    </>
  )
}
