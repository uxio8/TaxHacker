"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Translator } from "@/lib/i18n"
import type { UnsortedInboxSummary } from "@/models/unsorted-inbox"
import type { File } from "@/prisma/client"
import { Brain, ChevronDown, ChevronUp, Loader2, Settings, Trash2 } from "lucide-react"
import Link from "next/link"

export function AnalyzeFormHeader({
  file,
  summary,
  showHeaderDeleteAction,
  isDeleting,
  isAnalyzing,
  analyzeStep,
  isDetailsOpen,
  onDelete,
  onAnalyze,
  onToggleDetails,
  t,
}: {
  file: File
  summary: UnsortedInboxSummary
  showHeaderDeleteAction: boolean
  isDeleting: boolean
  isAnalyzing: boolean
  analyzeStep: string
  isDetailsOpen: boolean
  onDelete: () => void
  onAnalyze: () => void
  onToggleDetails: () => void
  t: Translator
}) {
  return (
    <div className="mb-6 rounded-xl border bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{summary.stateLabel}</Badge>
            {summary.reasonLabel ? <Badge variant="secondary">{summary.reasonLabel}</Badge> : null}
            {summary.confidenceLabel ? <Badge variant="secondary">{summary.confidenceLabel}</Badge> : null}
            {file.isSplitted ? <Badge variant="outline">{t("analysis.fileSplit")}</Badge> : null}
          </div>
          <p className="text-sm text-muted-foreground">{summary.description}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {showHeaderDeleteAction ? (
            <Button type="button" onClick={onDelete} variant="destructive" disabled={isDeleting}>
              <Trash2 className="h-4 w-4" />
              <span>{isDeleting ? t("common.feedback.deleting") : t("common.actions.delete")}</span>
            </Button>
          ) : null}

          {summary.primaryAction.kind === "analyze" ? (
            <Button onClick={onAnalyze} disabled={isAnalyzing} data-analyze-button>
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  <span>{analyzeStep}</span>
                </>
              ) : (
                <>
                  <Brain className="mr-1 h-4 w-4" />
                  <span>{summary.primaryAction.label}</span>
                </>
              )}
            </Button>
          ) : null}

          {summary.primaryAction.kind === "open_settings" ? (
            <Button asChild>
              <Link href={summary.primaryAction.href}>
                <Settings className="mr-1 h-4 w-4" />
                <span>{summary.primaryAction.label}</span>
              </Link>
            </Button>
          ) : null}

          {summary.primaryAction.kind === "open_details" ? (
            <Button type="button" variant="outline" onClick={onToggleDetails}>
              {isDetailsOpen ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
              <span>{isDetailsOpen ? "Ocultar detalles" : summary.primaryAction.label}</span>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
