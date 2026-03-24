import config from "@/lib/config"
import { hasSelfHostedAccess } from "@/lib/security"
import { createUserDefaults, isDatabaseEmpty } from "@/models/defaults"
import { getSelfHostedUser } from "@/models/users"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export default async function SelfHostedRedirectPage() {
  if (!config.selfHosted.isEnabled) {
    redirect(config.auth.loginUrl)
  }

  if (!config.selfHosted.adminToken) {
    redirect(config.selfHosted.welcomeUrl)
  }

  const cookieStore = await cookies()
  const hasAccess = await hasSelfHostedAccess(
    cookieStore.get(config.selfHosted.accessCookieName)?.value,
    config.selfHosted.adminToken,
    config.auth.secret
  )

  if (!hasAccess) {
    redirect(config.selfHosted.welcomeUrl)
  }

  const user = await getSelfHostedUser()
  if (!user) {
    redirect(config.selfHosted.welcomeUrl)
  }

  const organizationId = user.defaultOrganizationId ?? user.id

  if (await isDatabaseEmpty(organizationId)) {
    await createUserDefaults(organizationId)
  }

  redirect("/dashboard")
}

export const dynamic = "force-dynamic"
