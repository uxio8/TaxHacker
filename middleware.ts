import { default as globalConfig } from "@/lib/config"
import { hasSelfHostedAccess } from "@/lib/security"
import { getSessionCookie } from "better-auth/cookies"
import { NextRequest, NextResponse } from "next/server"

export default async function middleware(request: NextRequest) {
  if (globalConfig.selfHosted.isEnabled) {
    const hasAccess = await hasSelfHostedAccess(
      request.cookies.get(globalConfig.selfHosted.accessCookieName)?.value,
      globalConfig.selfHosted.adminToken,
      globalConfig.auth.secret
    )

    if (!hasAccess) {
      return NextResponse.redirect(new URL(globalConfig.selfHosted.welcomeUrl, request.url))
    }

    return NextResponse.next()
  }

  const sessionCookie = getSessionCookie(request, { cookiePrefix: "taxhacker" })
  if (!sessionCookie) {
    return NextResponse.redirect(new URL(globalConfig.auth.loginUrl, request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    "/transactions/:path*",
    "/settings/:path*",
    "/export/:path*",
    "/import/:path*",
    "/unsorted/:path*",
    "/files/:path*",
    "/dashboard/:path*",
  ],
}
