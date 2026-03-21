"use client"

import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"
import { Save, Swords } from "lucide-react"

export function AnalyzeAllButton() {
  const { t } = useI18n()

  const handleAnalyzeAll = () => {
    if (typeof document !== "undefined") {
      document.querySelectorAll("button[data-analyze-button]").forEach((button) => {
        ;(button as HTMLButtonElement).click()
      })
    }
  }

  const handleSaveAll = () => {
    if (typeof document !== "undefined") {
      document.querySelectorAll("button[data-save-button]").forEach((button) => {
        ;(button as HTMLButtonElement).click()
      })
    }
  }

  return (
    <div className="flex flex-row flex-wrap gap-2 justify-end">
      <Button variant="outline" className="flex items-center gap-2" onClick={handleSaveAll}>
        <Save className="h-4 w-4" />
        {t("common.actions.saveAll")}
      </Button>
      <Button className="flex items-center gap-2" onClick={handleAnalyzeAll}>
        <Swords className="h-4 w-4" />
        {t("common.actions.analyzeAll")}
      </Button>
    </div>
  )
}
