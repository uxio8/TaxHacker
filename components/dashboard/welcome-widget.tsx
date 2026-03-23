import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardTitle } from "@/components/ui/card"
import { ColoredText } from "@/components/ui/colored-text"
import { getCurrentUser } from "@/lib/auth"
import config from "@/lib/config"
import { createTranslator } from "@/lib/i18n"
import { requireCurrentOrganizationId } from "@/lib/tenant"
import { getSettings, updateSettings } from "@/models/settings"
import { Banknote, ChartBarStacked, FolderOpenDot, Key, TextCursorInput, X } from "lucide-react"
import { revalidatePath } from "next/cache"
import Image from "next/image"
import Link from "next/link"

export async function WelcomeWidget() {
  const t = createTranslator()
  const user = await getCurrentUser()
  const organizationId = await requireCurrentOrganizationId({
    getCurrentUser: async () => user,
  })
  const settings = await getSettings(organizationId)
  const docsLinks = [
    { href: config.links.repositoryUrl, label: t("dashboard.welcome.sourceCode") },
    { href: config.links.issuesUrl, label: t("dashboard.welcome.requestFeature") },
    { href: config.links.issuesUrl, label: t("dashboard.welcome.reportBug") },
    { href: `mailto:${config.app.supportEmail}`, label: t("dashboard.welcome.contactAuthor") },
  ].filter((link) => Boolean(link.href))

  return (
    <Card className="flex flex-col lg:flex-row items-start gap-10 p-10 w-full">
      <Image src="/logo/1024.png" alt="Logo" width={256} height={256} className="w-64 h-64" />
      <div className="flex flex-col">
        <CardTitle className="flex items-center justify-between">
          <span className="text-2xl font-bold">
            <ColoredText>{t("dashboard.welcome.title")}</ColoredText>
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label={t("dashboard.welcome.dismiss")}
            onClick={async () => {
              "use server"
              await updateSettings(organizationId, "is_welcome_message_hidden", "true")
              revalidatePath("/")
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardTitle>
        <CardDescription className="mt-5">
          <p className="mb-3">
            {t("dashboard.welcome.description")}
          </p>
          <ul className="mb-5 list-disc pl-5 space-y-1">
            <li>{t("dashboard.welcome.features.upload")}</li>
            <li>{t("dashboard.welcome.features.exchange")}</li>
            <li>{t("dashboard.welcome.features.crypto")}</li>
            <li>{t("dashboard.welcome.features.aiPrompts")}</li>
            <li>{t("dashboard.welcome.features.database")}</li>
            <li>{t("dashboard.welcome.features.customFields")}</li>
          </ul>
          <p className="mb-3">{t("dashboard.welcome.footer")}</p>
        </CardDescription>
        {docsLinks.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
            {docsLinks.map((link) => (
              <Link key={`${link.label}-${link.href}`} href={link.href!} className="text-blue-500 hover:underline">
                {link.label}
              </Link>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2 mt-8">
          {settings.openai_api_key === "" && (
            <Button asChild>
              <Link href="/settings/llm">
                <Key className="h-4 w-4" />
                {t("dashboard.welcome.giveApiKey")}
              </Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href="/settings">
              <Banknote className="h-4 w-4" />
              {t("dashboard.welcome.defaultCurrency", { currency: settings.default_currency })}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/settings/categories">
              <ChartBarStacked className="h-4 w-4" />
              {t("common.categories")}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/settings/projects">
              <FolderOpenDot className="h-4 w-4" />
              {t("common.projects")}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/settings/fields">
              <TextCursorInput className="h-4 w-4" />
              {t("common.customFields")}
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  )
}
