import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardTitle } from "@/components/ui/card"
import { ColoredText } from "@/components/ui/colored-text"
import { getCurrentUser } from "@/lib/auth"
import config from "@/lib/config"
import { createPageMetadata, createTranslator } from "@/lib/i18n"
import { stripeClient } from "@/lib/stripe"
import { requireCurrentOrganization } from "@/lib/tenant"
import {
  resolveStripeCheckoutSessionOrganizationId,
  shouldSyncStripeCheckoutSuccess,
} from "@/models/billing/checkout-success"
import { syncOrganizationSubscriptionFromStripeSubscription } from "@/models/billing/stripe-sync"
import { Cake, Ghost } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"

export const metadata = createPageMetadata("auth.cloud.payment.pageTitle")

export default async function CloudPaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const t = createTranslator()
  const { session_id: sessionId } = await searchParams

  if (!stripeClient || !sessionId) {
    redirect(config.auth.loginUrl)
  }

  const user = await getCurrentUser()
  const organization = await requireCurrentOrganization({
    getCurrentUser: async () => user,
  })
  const session = await stripeClient.checkout.sessions.retrieve(sessionId)

  if (session.mode === "subscription" && session.status === "complete" && session.subscription) {
    const sessionOrganizationId = resolveStripeCheckoutSessionOrganizationId(session)

    if (!shouldSyncStripeCheckoutSuccess(session, organization.id) || !sessionOrganizationId) {
      redirect("/settings/billing")
    }

    const subscriptionId =
      typeof session.subscription === "string" ? session.subscription : session.subscription.id
    const subscription = await stripeClient.subscriptions.retrieve(subscriptionId)

    await syncOrganizationSubscriptionFromStripeSubscription(subscription, {
      fallbackOrganizationId: sessionOrganizationId,
    })

    return (
      <Card className="mx-auto flex w-full max-w-xl flex-col items-center justify-center gap-4 p-8">
        <Cake className="h-36 w-36" />
        <CardTitle className="text-3xl font-bold">
          <ColoredText>{t("auth.cloud.payment.successTitle")}</ColoredText>
        </CardTitle>
        <CardDescription className="text-center text-xl">
          {t("auth.cloud.payment.successDescription", {
            name:
              session.customer_details?.name || session.customer_details?.email || session.customer_email || config.app.title,
          })}
        </CardDescription>
        <CardContent className="w-full text-center text-sm text-muted-foreground">
          {t("settings.subscription.currentPlan")}
        </CardContent>
        <CardFooter className="flex w-full flex-col gap-3 sm:flex-row">
          <Button asChild className="w-full">
            <Link href="/settings/billing">{t("common.billing")}</Link>
          </Button>
          <Button asChild className="w-full" variant="outline">
            <Link href="/dashboard">{t("globalError.goHome")}</Link>
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="mx-auto flex w-full max-w-xl flex-col items-center justify-center gap-4 p-8">
      <Ghost className="h-36 w-36" />
      <CardTitle className="text-3xl font-bold">{t("auth.cloud.payment.failedTitle")}</CardTitle>
      <CardDescription className="text-center text-xl">{t("auth.cloud.payment.failedDescription")}</CardDescription>
      <CardFooter>
        <Button asChild>
          <Link href="/">{t("globalError.goHome")}</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
