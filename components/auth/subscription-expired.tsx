import { createTranslator } from "@/lib/i18n"
import Link from "next/link"

export function SubscriptionExpired() {
  const t = createTranslator()

  return (
    <Link
      href="/settings/profile"
      className="w-full h-8 p-1 bg-red-500 text-white font-semibold text-center hover:bg-red-600 transition-colors"
    >
      {t("auth.subscription.expiredNotice")}
    </Link>
  )
}
