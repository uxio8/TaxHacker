import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { ColoredText } from "@/components/ui/colored-text"
import config from "@/lib/config"
import { createPageMetadata, createTranslator } from "@/lib/i18n"
import { Mail } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"

export const metadata = createPageMetadata("auth.cloud.metadataTitle")

export default async function ChoosePlanPage() {
  const t = createTranslator()

  if (config.selfHosted.isEnabled) {
    redirect(config.selfHosted.redirectUrl)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="w-full max-w-4xl mx-auto p-8 flex flex-col items-center justify-center gap-8">
        <CardTitle className="text-4xl font-bold text-center">
          <ColoredText>{t("auth.cloud.title")}</ColoredText>
          <h2 className="mt-3 text-2xl font-semibold text-muted-foreground">{t("auth.cloud.unavailableTitle")}</h2>
        </CardTitle>
        <CardContent className="p-0 w-full">
          <div className="text-center text-md text-muted-foreground">{t("auth.cloud.unavailableDescription")}</div>
        </CardContent>

        <div className="text-center text-muted-foreground">
          <Link
            href={`mailto:${config.app.supportEmail}`}
            className="flex flex-row gap-1 items-center hover:text-primary transition-colors underline"
          >
            <Mail className="w-4 h-4" />
            {t("auth.cloud.contactCustomPlans")}
          </Link>
        </div>
      </Card>
    </div>
  )
}
