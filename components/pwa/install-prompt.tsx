"use client"

import { Download, Share } from "lucide-react"
import { useState } from "react"

import { useInstallPrompt } from "@/components/pwa/use-install-prompt"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"

interface InstallPromptProps {
  className?: string
  variant?: "card" | "compact"
}

export function InstallPrompt({ className, variant = "card" }: InstallPromptProps) {
  const { t } = useI18n()
  const { canInstall, promptInstall, shouldRender, showIosFallback } = useInstallPrompt()
  const [isOpeningPrompt, setIsOpeningPrompt] = useState(false)

  if (!shouldRender) {
    return null
  }

  async function handleInstall() {
    setIsOpeningPrompt(true)

    try {
      await promptInstall()
    } finally {
      setIsOpeningPrompt(false)
    }
  }

  if (variant === "compact") {
    if (!canInstall) {
      return null
    }

    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={cn("h-8 rounded-full px-3 text-[11px] font-medium", className)}
        disabled={isOpeningPrompt}
        onClick={() => void handleInstall()}
      >
        <Download />
        {isOpeningPrompt ? t("capture.install.pending") : t("capture.install.cta")}
      </Button>
    )
  }

  return (
    <Card className={cn("rounded-[24px] border-slate-200/80 bg-white/90 p-4 shadow-sm", className)}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-sky-100 p-2 text-sky-700">
          {showIosFallback ? <Share className="h-4 w-4" /> : <Download className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold text-slate-900">{t("capture.install.title")}</p>
          <p className="text-sm text-muted-foreground">
            {showIosFallback ? t("capture.install.ios") : t("capture.install.description")}
          </p>
        </div>
        {canInstall ? (
          <Button
            type="button"
            className="shrink-0 rounded-full px-4"
            disabled={isOpeningPrompt}
            onClick={() => void handleInstall()}
          >
            {isOpeningPrompt ? t("capture.install.pending") : t("capture.install.cta")}
          </Button>
        ) : null}
      </div>
    </Card>
  )
}
