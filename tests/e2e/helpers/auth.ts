import type { Page } from "@playwright/test"
import {
  buildSelfHostedAccessCookieValue,
  SELF_HOSTED_ACCESS_COOKIE_NAME,
} from "../../../lib/security.ts"
import { getLocalEnvValue, requireLocalEnvValue } from "./env"

export async function loginAsSelfHosted(page: Page) {
  const adminToken = requireLocalEnvValue("SELF_HOSTED_ADMIN_TOKEN")
  const authSecret = requireLocalEnvValue("BETTER_AUTH_SECRET")
  const baseURL = getLocalEnvValue("PLAYWRIGHT_BASE_URL") || "http://127.0.0.1:7331"
  const cookieValue = await buildSelfHostedAccessCookieValue(adminToken, authSecret)

  await page.context().addCookies([
    {
      name: SELF_HOSTED_ACCESS_COOKIE_NAME,
      value: cookieValue,
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ])

  await page.goto("/self-hosted/redirect")
  await page.waitForURL("**/dashboard")
}
