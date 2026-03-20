import config from "@/lib/config"
import { hasSelfHostedAccess } from "@/lib/security"
import { createUserDefaults, isDatabaseEmpty } from "@/models/defaults"
import { getSelfHostedUser } from "@/models/users"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export async function GET() {
  if (!config.selfHosted.isEnabled) {
    redirect(config.auth.loginUrl)
  }

  if (!config.selfHosted.adminToken) {
    redirect(config.selfHosted.welcomeUrl)
  }

  const cookieStore = await cookies()
  const hasAccess = hasSelfHostedAccess(
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

  if (await isDatabaseEmpty(user.id)) {
    await createUserDefaults(user.id)
  }

  revalidatePath("/dashboard")
  redirect("/dashboard")
}
