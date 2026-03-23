"use client"

import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"
import { Save, Swords } from "lucide-react"

export function AnalyzeAllButton({
  analyzableCount,
  llmConfigured,
  saveableCount,
}: {
  analyzableCount: number
  llmConfigured: boolean
  saveableCount: number
}) {
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
    <div className="flex flex-col items-end gap-2">
      <p className="text-right text-sm text-muted-foreground">
        {llmConfigured
          ? `${analyzableCount} analizables, ${saveableCount} con borrador listo`
          : "Configura IA antes de lanzar análisis masivos"}
      </p>
      <div className="flex flex-row flex-wrap gap-2 justify-end">
      <Button variant="outline" className="flex items-center gap-2" onClick={handleSaveAll} disabled={saveableCount === 0}>
        <Save className="h-4 w-4" />
        {t("common.actions.saveAll")}
      </Button>
      <Button
        className="flex items-center gap-2"
        onClick={handleAnalyzeAll}
        disabled={!llmConfigured || analyzableCount === 0}
      >
        <Swords className="h-4 w-4" />
        {t("common.actions.analyzeAll")}
      </Button>
      </div>
    </div>
  )
}
