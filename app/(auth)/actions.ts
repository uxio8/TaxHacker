"use server"

import config from "@/lib/config"
import { buildSelfHostedAccessCookieValue } from "@/lib/security"
import { createUserDefaults, isDatabaseEmpty } from "@/models/defaults"
import { updateSettings } from "@/models/settings"
import { getOrCreateSelfHostedUser, getSelfHostedUser } from "@/models/users"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function selfHostedGetStartedAction(formData: FormData) {
  if (!config.selfHosted.isEnabled) {
    redirect(config.auth.loginUrl)
  }

  if (!config.selfHosted.adminToken) {
    redirect(`${config.selfHosted.welcomeUrl}?error=missing-token`)
  }

  const submittedToken = String(formData.get("self_hosted_admin_token") || "").trim()
  if (!submittedToken || submittedToken !== config.selfHosted.adminToken) {
    redirect(`${config.selfHosted.welcomeUrl}?error=invalid-token`)
  }

  const cookieStore = await cookies()
  cookieStore.set(
    config.selfHosted.accessCookieName,
    await buildSelfHostedAccessCookieValue(submittedToken, config.auth.secret),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: config.app.baseURL.startsWith("https://"),
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    }
  )

  const existingUser = await getSelfHostedUser()
  const user = existingUser ?? (await getOrCreateSelfHostedUser())
  const organizationId = user.defaultOrganizationId ?? user.id

  if (await isDatabaseEmpty(organizationId)) {
    await createUserDefaults(organizationId)
  }

  if (!existingUser) {
    const defaultCurrency = formData.get("default_currency")
    if (defaultCurrency) {
      await updateSettings(organizationId, "default_currency", defaultCurrency as string)
    }
  }

  revalidatePath(config.selfHosted.redirectUrl)
  redirect(config.selfHosted.redirectUrl)
}
