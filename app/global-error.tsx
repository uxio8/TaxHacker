"use client"

import { Button } from "@/components/ui/button"
import { createTranslator } from "@/lib/i18n"
import { isSentryRuntimeEnabled } from "@/lib/sentry"
import { Ghost } from "lucide-react"
import Link from "next/link"
import { useEffect } from "react"

export default function GlobalError({ error }: { error: Error }) {
  const t = createTranslator()
  useEffect(() => {
    if (!isSentryRuntimeEnabled()) {
      return
    }

    void import("@sentry/nextjs").then((Sentry) => {
      Sentry.captureException(error)
    })
  }, [error])

  return (
    <html>
      <body>
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
          <div className="text-center space-y-4">
            <Ghost className="w-24 h-24 text-destructive mx-auto" />
            <h1 className="text-4xl font-bold text-foreground">{t("globalError.title")}</h1>
            <p className="text-muted-foreground max-w-md mx-auto">{t("globalError.description")}</p>
            <div className="pt-4">
              <Button asChild>
                <Link href="/">{t("globalError.goHome")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
