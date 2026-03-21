import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardTitle } from "@/components/ui/card"
import { ColoredText } from "@/components/ui/colored-text"
import { getCurrentUser } from "@/lib/auth"
import { createTranslator } from "@/lib/i18n"
import { getSettings, updateSettings } from "@/models/settings"
import { Banknote, ChartBarStacked, FolderOpenDot, Key, TextCursorInput, X } from "lucide-react"
import { revalidatePath } from "next/cache"
import Image from "next/image"
import Link from "next/link"

export async function WelcomeWidget() {
  const t = createTranslator()
  const user = await getCurrentUser()
  const settings = await getSettings(user.id)

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
              await updateSettings(user.id, "is_welcome_message_hidden", "true")
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
        <div className="mt-2">
          <Link href="https://github.com/vas3k/TaxHacker" className="text-blue-500 hover:underline">
            {t("dashboard.welcome.sourceCode")}
          </Link>
          <span className="mx-2">|</span>
          <Link href="https://github.com/vas3k/TaxHacker/issues" className="text-blue-500 hover:underline">
            {t("dashboard.welcome.requestFeature")}
          </Link>
          <span className="mx-2">|</span>
          <Link href="https://github.com/vas3k/TaxHacker/issues" className="text-blue-500 hover:underline">
            {t("dashboard.welcome.reportBug")}
          </Link>
          <span className="mx-2">|</span>
          <Link href="mailto:me@vas3k.ru" className="text-blue-500 hover:underline">
            {t("dashboard.welcome.contactAuthor")}
          </Link>
        </div>
        <div className="flex flex-wrap gap-2 mt-8">
          {settings.openai_api_key === "" && (
            <Link href="/settings/llm">
              <Button>
                <Key className="h-4 w-4" />
                {t("dashboard.welcome.giveApiKey")}
              </Button>
            </Link>
          )}
          <Link href="/settings">
            <Button variant="outline">
              <Banknote className="h-4 w-4" />
              {t("dashboard.welcome.defaultCurrency", { currency: settings.default_currency })}
            </Button>
          </Link>
          <Link href="/settings/categories">
            <Button variant="outline">
              <ChartBarStacked className="h-4 w-4" />
              {t("common.categories")}
            </Button>
          </Link>
          <Link href="/settings/projects">
            <Button variant="outline">
              <FolderOpenDot className="h-4 w-4" />
              {t("common.projects")}
            </Button>
          </Link>
          <Link href="/settings/fields">
            <Button variant="outline">
              <TextCursorInput className="h-4 w-4" />
              {t("common.customFields")}
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  )
}
