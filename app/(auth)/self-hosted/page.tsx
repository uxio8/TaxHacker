import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { ColoredText } from "@/components/ui/colored-text"
import config from "@/lib/config"
import { createTranslator } from "@/lib/i18n"
import { hasSelfHostedAccess } from "@/lib/security"
import { getSelfHostedUser } from "@/models/users"
import { ShieldAlert } from "lucide-react"
import Image from "next/image"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import SelfHostedSetupFormClient from "./setup-form-client"

type SelfHostedErrorCode = "invalid-token" | "missing-token"

export default async function SelfHostedWelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: SelfHostedErrorCode }>
}) {
  const t = createTranslator()
  const SELF_HOSTED_ERROR_MESSAGES = {
    "invalid-token": t("auth.selfHosted.errors.invalidToken"),
    "missing-token": t("auth.selfHosted.errors.missingToken"),
  } as const

  if (!config.selfHosted.isEnabled) {
    return (
      <Card className="w-full max-w-xl mx-auto p-8 flex flex-col items-center justify-center gap-6">
        <CardTitle className="text-2xl font-bold flex items-center gap-2">
          <ShieldAlert className="w-6 h-6" />
          <span>{t("auth.selfHosted.disabledTitle")}</span>
        </CardTitle>
        <CardDescription className="text-center text-lg flex flex-col gap-2">
          <p>
            {t("auth.selfHosted.disabledDescription")}
          </p>
          <p>{t("auth.selfHosted.disabledDescriptionSecondary")}</p>
        </CardDescription>
      </Card>
    )
  }

  if (!config.selfHosted.adminToken) {
    return (
      <Card className="w-full max-w-xl mx-auto p-8 flex flex-col items-center justify-center gap-6">
        <CardTitle className="text-2xl font-bold flex items-center gap-2">
          <ShieldAlert className="w-6 h-6" />
          <span>{t("auth.selfHosted.missingTokenTitle")}</span>
        </CardTitle>
        <CardDescription className="text-center text-lg flex flex-col gap-2">
          <p>{t("auth.selfHosted.missingTokenDescription")}</p>
          <p>{t("auth.selfHosted.missingTokenWarning")}</p>
        </CardDescription>
      </Card>
    )
  }

  const params = await searchParams
  const user = await getSelfHostedUser()
  const cookieStore = await cookies()
  const hasAccess = await hasSelfHostedAccess(
    cookieStore.get(config.selfHosted.accessCookieName)?.value,
    config.selfHosted.adminToken,
    config.auth.secret
  )

  if (user && hasAccess) {
    redirect(config.selfHosted.redirectUrl)
  }

  const requiresSetup = !user
  const errorMessage = params.error ? SELF_HOSTED_ERROR_MESSAGES[params.error] : null

  return (
    <Card className="w-full max-w-xl mx-auto p-8 flex flex-col items-center justify-center gap-4">
      <Image src="/logo/512.png" alt={t("auth.logoAlt")} width={144} height={144} className="w-36 h-36" />
      <CardTitle className="text-3xl font-bold ">
        <ColoredText>{t("auth.selfHosted.title")}</ColoredText>
      </CardTitle>
      <CardDescription className="flex flex-col gap-4 text-center text-lg">
        <p>{requiresSetup ? t("auth.selfHosted.setupDescription") : t("auth.selfHosted.unlockDescription")}</p>
      </CardDescription>
      {errorMessage ? (
        <CardContent className="w-full pt-0">
          <p className="text-sm text-red-600 text-center">{errorMessage}</p>
        </CardContent>
      ) : null}
      <SelfHostedSetupFormClient requiresSetup={requiresSetup} />
    </Card>
  )
}

export const dynamic = "force-dynamic"
