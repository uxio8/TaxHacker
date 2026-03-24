"use client"

import { useNotification } from "@/app/(app)/context"
import { deleteUnsortedFileAction, saveFileAsTransactionAction, startAnalysisJobAction } from "@/app/(app)/unsorted/actions"
import { FormError } from "@/components/forms/error"
import { AnalyzeFormDetails } from "@/components/unsorted/analyze-form/details"
import { buildAnalyzeFormDerivedState, buildAnalyzeFormEffectiveSummary } from "@/components/unsorted/analyze-form/derived-state"
import { AnalyzeFormHeader } from "@/components/unsorted/analyze-form/header"
import { pollAnalysisJob } from "@/components/unsorted/analyze-form/poll-analysis-job"
import { buildAnalyzeFormState } from "@/components/unsorted/analyze-form-state"
import { getAnalyzedDocumentTitle } from "@/lib/analyzed-file-name"
import { useI18n } from "@/lib/i18n"
import type { UnsortedInboxSummary } from "@/models/unsorted-inbox"
import { Category, Currency, Field, File, Project } from "@/prisma/client"
import { useRouter } from "next/navigation"
import { startTransition, useActionState, useEffect, useMemo, useState } from "react"

export default function AnalyzeForm({
  file,
  categories,
  projects,
  currencies,
  fields,
  settings,
  summary,
}: {
  file: File
  categories: Category[]
  projects: Project[]
  currencies: Currency[]
  fields: Field[]
  settings: Record<string, string>
  summary: UnsortedInboxSummary
}) {
  const { showNotification } = useNotification()
  const { t } = useI18n()
  const router = useRouter()
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analyzeStep, setAnalyzeStep] = useState<string>("")
  const [analyzeError, setAnalyzeError] = useState<string>("")
  const [deleteState, deleteAction, isDeleting] = useActionState(deleteUnsortedFileAction, null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const { fieldMap, extraFields, invoiceFields, issuerFields, remainingExtraFields } = useMemo(
    () => buildAnalyzeFormDerivedState(fields),
    [fields]
  )
  const initialFormState = useMemo(
    () =>
      buildAnalyzeFormState({
        filename: file.filename,
        cachedParseResult: file.cachedParseResult as Record<string, unknown> | null | undefined,
        settings,
        extraFields,
      }),
    [extraFields, file.cachedParseResult, file.filename, settings]
  )
  const [localCachedParseResult, setLocalCachedParseResult] = useState<Record<string, unknown> | null>(() =>
    isRecord(file.cachedParseResult) ? file.cachedParseResult : null
  )
  const [formData, setFormData] = useState(initialFormState)
  const [isDetailsOpen, setIsDetailsOpen] = useState(summary.defaultDetailsOpen)
  const effectiveSummary = useMemo(
    () =>
      buildAnalyzeFormEffectiveSummary({
        file,
        summary,
        localCachedParseResult,
      }),
    [file, localCachedParseResult, summary]
  )
  const showHeaderDeleteAction = effectiveSummary.state === "pending_analysis"

  const handleDelete = () => {
    startTransition(async () => {
      await deleteAction(file.id)
    })
  }

  useEffect(() => {
    if (deleteState?.success) {
      router.refresh()
    }
  }, [deleteState, router])

  async function saveAsTransaction(formData: FormData) {
    setSaveError("")
    setIsSaving(true)
    startTransition(async () => {
      const result = await saveFileAsTransactionAction(null, formData)
      setIsSaving(false)

      if (result.success) {
        showNotification({ code: "global.banner", message: t("analysis.saved"), type: "success" })
        showNotification({ code: "sidebar.transactions", message: "new" })
        setTimeout(() => showNotification({ code: "sidebar.transactions", message: "" }), 3000)
      } else {
        setSaveError(result.error ? result.error : t("common.errors.generic"))
        showNotification({ code: "global.banner", message: t("analysis.saveFailed"), type: "failed" })
      }
    })
  }

  const startAnalyze = async () => {
    setIsAnalyzing(true)
    setAnalyzeError("")

    try {
      setAnalyzeStep(t("analysis.queueing"))
      const results = await startAnalysisJobAction(file, settings, fields, categories, projects)

      if (!results.success || !results.data) {
        setAnalyzeError(results.error ? results.error : t("common.errors.generic"))
      } else {
        const output = await pollAnalysisJob({
          jobId: results.data.jobId,
          t,
          onStepChange: setAnalyzeStep,
        })
        const nonEmptyFields = Object.fromEntries(
          Object.entries(output).filter(([, value]) => value !== null && value !== undefined && value !== "")
        )
        setLocalCachedParseResult((prev) => ({
          ...(prev ?? {}),
          ...nonEmptyFields,
        }))
        setFormData((prev) => ({
          ...prev,
          ...nonEmptyFields,
          name: getAnalyzedDocumentTitle(file.filename, output),
        }))
        setIsDetailsOpen(true)
        router.refresh()
      }
    } catch (error) {
      console.error("Analysis failed:", error)
      setAnalyzeError(error instanceof Error ? error.message : t("analysis.failed"))
    } finally {
      setIsAnalyzing(false)
      setAnalyzeStep("")
    }
  }

  return (
    <>
      <AnalyzeFormHeader
        file={file}
        summary={effectiveSummary}
        showHeaderDeleteAction={showHeaderDeleteAction}
        isDeleting={isDeleting}
        isAnalyzing={isAnalyzing}
        analyzeStep={analyzeStep}
        isDetailsOpen={isDetailsOpen}
        onDelete={handleDelete}
        onAnalyze={startAnalyze}
        onToggleDetails={() => setIsDetailsOpen((currentState) => !currentState)}
        t={t}
      />

      <div>
        {analyzeError ? <FormError>{analyzeError}</FormError> : null}
        {deleteState?.error ? <FormError>{deleteState.error}</FormError> : null}
      </div>

      <form className="space-y-4" action={saveAsTransaction}>
        <input type="hidden" name="fileId" value={file.id} />
        {isDetailsOpen ? (
          <AnalyzeFormDetails
            file={file}
            categories={categories}
            projects={projects}
            currencies={currencies}
            settings={settings}
            fieldMap={fieldMap}
            invoiceFields={invoiceFields}
            issuerFields={issuerFields}
            remainingExtraFields={remainingExtraFields}
            formData={formData}
            isDeleting={isDeleting}
            isSaving={isSaving}
            saveError={saveError}
            onDelete={handleDelete}
            onFormDataChange={setFormData}
            t={t}
          />
        ) : null}
      </form>
    </>
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
