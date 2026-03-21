import { LoginForm } from "@/components/auth/login-form"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { ColoredText } from "@/components/ui/colored-text"
import config from "@/lib/config"
import { createPageMetadata, createTranslator } from "@/lib/i18n"
import Image from "next/image"
import { redirect } from "next/navigation"

export const metadata = createPageMetadata("auth.enter.metadataTitle")

export default async function LoginPage() {
  const t = createTranslator()

  if (config.selfHosted.isEnabled) {
    redirect(config.selfHosted.redirectUrl)
  }

  return (
    <Card className="w-full max-w-xl mx-auto p-8 flex flex-col items-center justify-center gap-4">
      <Image src="/logo/512.png" alt={t("auth.logoAlt")} width={144} height={144} className="w-36 h-36" />
      <CardTitle className="text-3xl font-bold ">
        <ColoredText>{t("auth.enter.title")}</ColoredText>
      </CardTitle>
      <CardContent className="w-full">
        <LoginForm />
      </CardContent>
    </Card>
  )
}
