import { LoginForm } from "@/components/auth/login-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardTitle } from "@/components/ui/card"
import { ColoredText } from "@/components/ui/colored-text"
import config from "@/lib/config"
import { createPageMetadata, createTranslator } from "@/lib/i18n"
import { PLANS, stripeClient } from "@/lib/stripe"
import { createUserDefaults, isDatabaseEmpty } from "@/models/defaults"
import { getOrCreateCloudUser } from "@/models/users"
import { Cake, Ghost } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import Stripe from "stripe"

export const metadata = createPageMetadata("auth.cloud.payment.pageTitle")

export default async function CloudPaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id: string }>
}) {
  const t = createTranslator()
  const { session_id: sessionId } = await searchParams

  if (!stripeClient || !sessionId) {
    redirect(config.auth.loginUrl)
  }

  const session = await stripeClient.checkout.sessions.retrieve(sessionId)

  if (session.mode === "subscription" && session.status === "complete") {
    const subscription = (await stripeClient.subscriptions.retrieve(
      session.subscription as string
    )) as Stripe.Subscription

    const plan = Object.values(PLANS).find((p) => p.stripePriceId === subscription.items.data[0].price.id)
    const email = session.customer_details?.email || session.customer_email || ""
    const user = await getOrCreateCloudUser(email, {
      email: email,
      name: session.customer_details?.name || session.customer_details?.email || session.customer_email || "",
      stripeCustomerId: session.customer as string,
      membershipPlan: plan?.code,
      membershipExpiresAt: new Date(subscription.items.data[0].current_period_end * 1000),
      storageLimit: plan?.limits.storage,
      aiBalance: plan?.limits.ai,
    })

    return (
      <Card className="w-full max-w-xl mx-auto p-8 flex flex-col items-center justify-center gap-4">
        <Cake className="w-36 h-36" />
        <CardTitle className="text-3xl font-bold ">
          <ColoredText>{t("auth.cloud.payment.successTitle")}</ColoredText>
        </CardTitle>
        <CardDescription className="text-center text-xl">
          {t("auth.cloud.payment.successDescription", { name: user.name })}
        </CardDescription>
        <CardContent className="w-full">
          <LoginForm defaultEmail={user.email} />
        </CardContent>
      </Card>
    )
  } else {
    return (
      <Card className="w-full max-w-xl mx-auto p-8 flex flex-col items-center justify-center gap-4">
        <Ghost className="w-36 h-36" />
        <CardTitle className="text-3xl font-bold ">{t("auth.cloud.payment.failedTitle")}</CardTitle>
        <CardDescription className="text-center text-xl">{t("auth.cloud.payment.failedDescription")}</CardDescription>
        <CardFooter>
          <Button asChild>
            <Link href="/">{t("globalError.goHome")}</Link>
          </Button>
        </CardFooter>
      </Card>
    )
  }
}
