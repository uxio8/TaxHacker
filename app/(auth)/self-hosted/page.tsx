import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { ColoredText } from "@/components/ui/colored-text"
import config from "@/lib/config"
import { PROVIDERS } from "@/lib/llm-providers"
import { hasSelfHostedAccess } from "@/lib/security"
import { getSelfHostedUser } from "@/models/users"
import { ShieldAlert } from "lucide-react"
import Image from "next/image"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import SelfHostedSetupFormClient from "./setup-form-client"

const SELF_HOSTED_ERROR_MESSAGES = {
  "invalid-token": "Invalid admin token.",
  "missing-token": "SELF_HOSTED_ADMIN_TOKEN is not configured.",
} as const

type SelfHostedErrorCode = keyof typeof SELF_HOSTED_ERROR_MESSAGES

export default async function SelfHostedWelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: SelfHostedErrorCode }>
}) {
  if (!config.selfHosted.isEnabled) {
    return (
      <Card className="w-full max-w-xl mx-auto p-8 flex flex-col items-center justify-center gap-6">
        <CardTitle className="text-2xl font-bold flex items-center gap-2">
          <ShieldAlert className="w-6 h-6" />
          <span>Self-Hosted Mode is not enabled</span>
        </CardTitle>
        <CardDescription className="text-center text-lg flex flex-col gap-2">
          <p>
            To use TaxHacker in self-hosted mode, please set <code className="font-bold">SELF_HOSTED_MODE=true</code> in
            your environment.
          </p>
          <p>In self-hosted mode you can use your own ChatGPT API key and store your data on your own server.</p>
        </CardDescription>
      </Card>
    )
  }

  if (!config.selfHosted.adminToken) {
    return (
      <Card className="w-full max-w-xl mx-auto p-8 flex flex-col items-center justify-center gap-6">
        <CardTitle className="text-2xl font-bold flex items-center gap-2">
          <ShieldAlert className="w-6 h-6" />
          <span>Missing self-hosted admin token</span>
        </CardTitle>
        <CardDescription className="text-center text-lg flex flex-col gap-2">
          <p>
            Set <code className="font-bold">SELF_HOSTED_ADMIN_TOKEN</code> to unlock this self-hosted instance safely.
          </p>
          <p>Without it, anyone who can reach the app could have taken over the singleton self-hosted account.</p>
        </CardDescription>
      </Card>
    )
  }

  const params = await searchParams
  const user = await getSelfHostedUser()
  const cookieStore = await cookies()
  const hasAccess = hasSelfHostedAccess(
    cookieStore.get(config.selfHosted.accessCookieName)?.value,
    config.selfHosted.adminToken,
    config.auth.secret
  )

  if (user && hasAccess) {
    redirect(config.selfHosted.redirectUrl)
  }

  const defaultProvider = PROVIDERS[0].key
  const defaultApiKeys: Record<string, string> = {
    openai: config.ai.openaiApiKey ?? "",
    google: config.ai.googleApiKey ?? "",
    mistral: config.ai.mistralApiKey ?? "",
  }
  const requiresSetup = !user
  const errorMessage = params.error ? SELF_HOSTED_ERROR_MESSAGES[params.error] : null

  return (
    <Card className="w-full max-w-xl mx-auto p-8 flex flex-col items-center justify-center gap-4">
      <Image src="/logo/512.png" alt="Logo" width={144} height={144} className="w-36 h-36" />
      <CardTitle className="text-3xl font-bold ">
        <ColoredText>TaxHacker: Self-Hosted Edition</ColoredText>
      </CardTitle>
      <CardDescription className="flex flex-col gap-4 text-center text-lg">
        <p>
          {requiresSetup
            ? "Unlock this instance with your admin token and finish the initial setup."
            : "Unlock this instance with your admin token to access the self-hosted account."}
        </p>
      </CardDescription>
      {errorMessage ? (
        <CardContent className="w-full pt-0">
          <p className="text-sm text-red-600 text-center">{errorMessage}</p>
        </CardContent>
      ) : null}
      <SelfHostedSetupFormClient
        defaultProvider={defaultProvider}
        defaultApiKeys={defaultApiKeys}
        requiresSetup={requiresSetup}
      />
    </Card>
  )
}

export const dynamic = "force-dynamic"
