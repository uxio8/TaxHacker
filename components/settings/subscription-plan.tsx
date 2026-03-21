import { User } from "@/prisma/client"

import { PricingCard } from "@/components/auth/pricing-card"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import config from "@/lib/config"
import { createTranslator } from "@/lib/i18n"
import { PLANS } from "@/lib/stripe"
import { formatBytes, formatNumber } from "@/lib/utils"
import { formatDate } from "date-fns"
import { BrainCog, CalendarSync, HardDrive } from "lucide-react"
import Link from "next/link"
import { Badge } from "../ui/badge"

export function SubscriptionPlan({ user }: { user: User }) {
  const t = createTranslator()
  const plan = PLANS[user.membershipPlan as keyof typeof PLANS] || PLANS.unlimited

  return (
    <div className="flex flex-wrap gap-5">
      <div className="flex flex-col gap-2 flex-1 items-center justify-center max-w-[300px]">
        <PricingCard plan={plan} hideButton={true} />
        <Badge variant="outline">{t("settings.subscription.currentPlan")}</Badge>
      </div>
      <div className="flex-1">
        <Card className="w-full p-4">
          <div className="space-y-2">
            <strong className="text-lg">{t("settings.subscription.usage")}:</strong>
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              <span>
                <strong className="font-semibold">{t("settings.subscription.storage")}:</strong>{" "}
                {formatBytes(user.storageUsed)} /{" "}
                {user.storageLimit > 0 ? formatBytes(user.storageLimit) : t("settings.subscription.unlimited")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <BrainCog className="h-4 w-4" />
              <span>
                <strong className="font-semibold">{t("settings.subscription.aiAnalyses")}:</strong>{" "}
                {formatNumber(plan.limits.ai - user.aiBalance)} /{" "}
                {plan.limits.ai > 0 ? formatNumber(plan.limits.ai) : t("settings.subscription.unlimited")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarSync className="h-4 w-4" />
              <span>
                <strong className="font-semibold">{t("settings.subscription.expirationDate")}:</strong>{" "}
                {user.membershipExpiresAt ? formatDate(user.membershipExpiresAt, "yyyy-MM-dd") : t("settings.subscription.never")}
              </span>
            </div>
          </div>

          <div className="space-y-4 mt-6 text-center">
            {user.stripeCustomerId && (
              <Button asChild className="w-full">
                <Link href="/api/stripe/portal">{t("settings.subscription.manage")}</Link>
              </Button>
            )}

            {!user.stripeCustomerId && user.membershipExpiresAt && (
              <Button asChild className="w-full">
                <Link href="/cloud">{t("settings.subscription.buy")}</Link>
              </Button>
            )}

            <Link href={`mailto:${config.app.supportEmail}`} className="block text-sm text-muted-foreground">
              {t("settings.subscription.contactSupport")}
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
