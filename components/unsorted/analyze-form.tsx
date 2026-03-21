"use client"

import { useNotification } from "@/app/(app)/context"
import { deleteUnsortedFileAction, saveFileAsTransactionAction, startAnalysisJobAction } from "@/app/(app)/unsorted/actions"
import { CurrencyConverterTool } from "@/components/agents/currency-converter"
import { ItemsDetectTool } from "@/components/agents/items-detect"
import ToolWindow from "@/components/agents/tool-window"
import { FormError } from "@/components/forms/error"
import { FormSelectCategory } from "@/components/forms/select-category"
import { FormSelectCurrency } from "@/components/forms/select-currency"
import { FormSelectProject } from "@/components/forms/select-project"
import { FormSelectType } from "@/components/forms/select-type"
import { FormInput, FormTextarea } from "@/components/forms/simple"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { canAnalyzeFileMimeType, getAnalyzeMimeTypeError } from "@/lib/analysis-support"
import { useI18n, type Translator } from "@/lib/i18n"
import { Category, Currency, Field, File, Project } from "@/prisma/client"
import { format } from "date-fns"
import { ArrowDownToLine, Brain, Loader2, Trash2 } from "lucide-react"
import { startTransition, useActionState, useMemo, useState } from "react"

const ANALYSIS_JOB_POLL_INTERVAL_MS = 1500
const ANALYSIS_JOB_TIMEOUT_MS = 10 * 60 * 1000
const INVOICE_FIELD_CODES = new Set(["invoice_number"])
const BILLING_FIELD_CODES = new Set([
  "billing_company_name",
  "billing_tax_id",
  "billing_address",
  "billing_postal_code",
  "billing_city",
  "billing_country",
])

type AnalysisJobResponse = {
  status: string
  error?: string | null
  result?: Record<string, string> | null
}

export default function AnalyzeForm({
  file,
  categories,
  projects,
  currencies,
  fields,
  settings,
}: {
  file: File
  categories: Category[]
  projects: Project[]
  currencies: Currency[]
  fields: Field[]
  settings: Record<string, string>
}) {
  const { showNotification } = useNotification()
  const { t } = useI18n()
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analyzeStep, setAnalyzeStep] = useState<string>("")
  const [analyzeError, setAnalyzeError] = useState<string>("")
  const [deleteState, deleteAction, isDeleting] = useActionState(deleteUnsortedFileAction, null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const canAnalyzeCurrentFile = canAnalyzeFileMimeType(file.mimetype)

  const fieldMap = useMemo(() => {
    return fields.reduce(
      (acc, field) => {
        acc[field.code] = field
        return acc
      },
      {} as Record<string, Field>
    )
  }, [fields])

  const extraFields = useMemo(() => fields.filter((field) => field.isExtra), [fields])
  const invoiceFields = useMemo(
    () => extraFields.filter((field) => INVOICE_FIELD_CODES.has(field.code)),
    [extraFields]
  )
  const billingFields = useMemo(
    () => extraFields.filter((field) => BILLING_FIELD_CODES.has(field.code)),
    [extraFields]
  )
  const remainingExtraFields = useMemo(
    () => extraFields.filter((field) => !INVOICE_FIELD_CODES.has(field.code) && !BILLING_FIELD_CODES.has(field.code)),
    [extraFields]
  )
  const initialFormState = useMemo(() => {
    const baseState = {
      name: file.filename,
      merchant: "",
      description: "",
      type: settings.default_type,
      total: 0.0,
      currencyCode: settings.default_currency,
      convertedTotal: 0.0,
      convertedCurrencyCode: settings.default_currency,
      categoryCode: settings.default_category,
      projectCode: settings.default_project,
      issuedAt: "",
      note: "",
      text: "",
      items: [],
    }

    // Add extra fields
    const extraFieldsState = extraFields.reduce(
      (acc, field) => {
        acc[field.code] = ""
        return acc
      },
      {} as Record<string, string>
    )

    // Load cached results if they exist
    const cachedResults = file.cachedParseResult
      ? Object.fromEntries(
          Object.entries(file.cachedParseResult as Record<string, string>).filter(
            ([_, value]) => value !== null && value !== undefined && value !== ""
          )
        )
      : {}

    return {
      ...baseState,
      ...extraFieldsState,
      ...cachedResults,
    }
  }, [file.filename, settings, extraFields, file.cachedParseResult])
  const [formData, setFormData] = useState(initialFormState)

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

  async function pollAnalysisJob(jobId: string) {
    const startedAt = Date.now()

    while (Date.now() - startedAt < ANALYSIS_JOB_TIMEOUT_MS) {
      const response = await fetch(`/api/analysis-jobs/${jobId}`, {
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error(t("analysis.readStatusFailed"))
      }

      const job = (await response.json()) as AnalysisJobResponse
      setAnalyzeStep(getAnalyzeStepLabel(job.status, t))

      if (job.status === "succeeded") {
        return job.result || {}
      }

      if (job.status === "failed" || job.status === "cancelled") {
        throw new Error(job.error || t("analysis.failed"))
      }

      await new Promise((resolve) => setTimeout(resolve, ANALYSIS_JOB_POLL_INTERVAL_MS))
    }

    throw new Error(t("analysis.timeout"))
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
        const output = await pollAnalysisJob(results.data.jobId)
        const nonEmptyFields = Object.fromEntries(
          Object.entries(output).filter(([_, value]) => value !== null && value !== undefined && value !== "")
        )
        setFormData((prev) => ({ ...prev, ...nonEmptyFields }))
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
      {file.isSplitted ? (
        <div className="flex justify-end">
          <Badge variant="outline">{t("analysis.fileSplit")}</Badge>
        </div>
      ) : !canAnalyzeCurrentFile ? (
        <div className="mb-6 rounded-md border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {getAnalyzeMimeTypeError(file.mimetype)}
        </div>
      ) : (
        <Button className="w-full mb-6 py-6 text-lg" onClick={startAnalyze} disabled={isAnalyzing} data-analyze-button>
          {isAnalyzing ? (
            <>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              <span>{analyzeStep}</span>
            </>
          ) : (
            <>
              <Brain className="mr-1 h-4 w-4" />
              <span>{t("analysis.analyze")}</span>
            </>
          )}
        </Button>
      )}

      <div>{analyzeError && <FormError>{analyzeError}</FormError>}</div>

      <form className="space-y-4" action={saveAsTransaction}>
        <input type="hidden" name="fileId" value={file.id} />
        <FormInput
          title={fieldMap.name.name}
          name="name"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          required={fieldMap.name.isRequired}
        />

        <FormInput
          title={fieldMap.merchant.name}
          name="merchant"
          value={formData.merchant}
          onChange={(e) => setFormData((prev) => ({ ...prev, merchant: e.target.value }))}
          hideIfEmpty={!fieldMap.merchant.isVisibleInAnalysis}
          required={fieldMap.merchant.isRequired}
        />

        <FormInput
          title={fieldMap.description.name}
          name="description"
          value={formData.description}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          hideIfEmpty={!fieldMap.description.isVisibleInAnalysis}
          required={fieldMap.description.isRequired}
        />

        <div className="flex flex-wrap gap-4">
          <FormInput
            title={fieldMap.total.name}
            name="total"
            type="number"
            step="0.01"
            value={formData.total || ""}
            onChange={(e) => {
              const newValue = parseFloat(e.target.value || "0")
              !isNaN(newValue) && setFormData((prev) => ({ ...prev, total: newValue }))
            }}
            className="w-32"
            required={fieldMap.total.isRequired}
          />

          <FormSelectCurrency
            title={fieldMap.currencyCode.name}
            currencies={currencies}
            name="currencyCode"
            value={formData.currencyCode}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, currencyCode: value }))}
            hideIfEmpty={!fieldMap.currencyCode.isVisibleInAnalysis}
            required={fieldMap.currencyCode.isRequired}
          />

          <FormSelectType
            title={fieldMap.type.name}
            name="type"
            value={formData.type}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, type: value }))}
            hideIfEmpty={!fieldMap.type.isVisibleInAnalysis}
            required={fieldMap.type.isRequired}
          />
        </div>

        {formData.total != 0 && formData.currencyCode && formData.currencyCode !== settings.default_currency && (
          <ToolWindow
            title={t("analysis.exchangeRateOn", {
              date: format(new Date(formData.issuedAt || Date.now()), "dd/MM/yyyy"),
            })}
          >
            <CurrencyConverterTool
              originalTotal={formData.total}
              originalCurrencyCode={formData.currencyCode}
              targetCurrencyCode={settings.default_currency}
              date={new Date(formData.issuedAt || Date.now())}
              onChange={(value) => setFormData((prev) => ({ ...prev, convertedTotal: value }))}
            />
            <input type="hidden" name="convertedCurrencyCode" value={settings.default_currency} />
          </ToolWindow>
        )}

        <div className="flex flex-row gap-4">
          <FormInput
            title={fieldMap.issuedAt.name}
            type="date"
            name="issuedAt"
            value={formData.issuedAt}
            onChange={(e) => setFormData((prev) => ({ ...prev, issuedAt: e.target.value }))}
            hideIfEmpty={!fieldMap.issuedAt.isVisibleInAnalysis}
            required={fieldMap.issuedAt.isRequired}
          />
        </div>

        <div className="flex flex-row gap-4">
          <FormSelectCategory
            title={fieldMap.categoryCode.name}
            categories={categories}
            name="categoryCode"
            value={formData.categoryCode}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, categoryCode: value }))}
            placeholder={t("analysis.selectCategory")}
            hideIfEmpty={!fieldMap.categoryCode.isVisibleInAnalysis}
            required={fieldMap.categoryCode.isRequired}
          />

          {projects.length > 0 && (
            <FormSelectProject
              title={fieldMap.projectCode.name}
              projects={projects}
              name="projectCode"
              value={formData.projectCode}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, projectCode: value }))}
              placeholder={t("analysis.selectProject")}
              hideIfEmpty={!fieldMap.projectCode.isVisibleInAnalysis}
              required={fieldMap.projectCode.isRequired}
            />
          )}
        </div>

        <FormInput
          title={fieldMap.note.name}
          name="note"
          value={formData.note}
          onChange={(e) => setFormData((prev) => ({ ...prev, note: e.target.value }))}
          hideIfEmpty={!fieldMap.note.isVisibleInAnalysis}
          required={fieldMap.note.isRequired}
        />

        {invoiceFields.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              {t("analysis.sectionInvoice")}
            </h3>
            {invoiceFields.map((field) => (
              <FormInput
                key={field.code}
                type="text"
                title={field.name}
                name={field.code}
                value={formData[field.code as keyof typeof formData]}
                onChange={(e) => setFormData((prev) => ({ ...prev, [field.code]: e.target.value }))}
                hideIfEmpty={!field.isVisibleInAnalysis}
                required={field.isRequired}
              />
            ))}
          </div>
        )}

        {billingFields.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              {t("analysis.sectionBillingDetails")}
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {billingFields.map((field) => (
                <FormInput
                  key={field.code}
                  type="text"
                  title={field.name}
                  name={field.code}
                  value={formData[field.code as keyof typeof formData]}
                  onChange={(e) => setFormData((prev) => ({ ...prev, [field.code]: e.target.value }))}
                  hideIfEmpty={!field.isVisibleInAnalysis}
                  required={field.isRequired}
                />
              ))}
            </div>
          </div>
        )}

        {remainingExtraFields.map((field) => (
          <FormInput
            key={field.code}
            type="text"
            title={field.name}
            name={field.code}
            value={formData[field.code as keyof typeof formData]}
            onChange={(e) => setFormData((prev) => ({ ...prev, [field.code]: e.target.value }))}
            hideIfEmpty={!field.isVisibleInAnalysis}
            required={field.isRequired}
          />
        ))}

        {formData.items && formData.items.length > 0 && (
          <ToolWindow title={t("analysis.detectedItems")}>
            <ItemsDetectTool file={file} data={formData} />
          </ToolWindow>
        )}

        <div className="hidden">
          <input type="text" name="items" value={JSON.stringify(formData.items)} readOnly />
          <FormTextarea
            title={fieldMap.text.name}
            name="text"
            value={formData.text}
            onChange={(e) => setFormData((prev) => ({ ...prev, text: e.target.value }))}
            hideIfEmpty={!fieldMap.text.isVisibleInAnalysis}
          />
        </div>

        <div className="flex justify-between gap-4 pt-6">
          <Button
            type="button"
            onClick={() => startTransition(() => deleteAction(file.id))}
            variant="destructive"
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4" />
            {isDeleting ? t("common.feedback.deleting") : t("common.actions.delete")}
          </Button>

          <Button type="submit" disabled={isSaving} data-save-button>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("common.feedback.saving")}
              </>
            ) : (
              <>
                <ArrowDownToLine className="h-4 w-4" />
                {t("transactions.saveTransaction")}
              </>
            )}
          </Button>
        </div>

        <div>
          {deleteState?.error && <FormError>{deleteState.error}</FormError>}
          {saveError && <FormError>{saveError}</FormError>}
        </div>
      </form>
    </>
  )
}

function getAnalyzeStepLabel(status: string, t: Translator) {
  switch (status) {
    case "queued":
      return t("analysis.queued")
    case "acquiring_lease":
      return t("analysis.acquiringLease")
    case "running":
      return t("analysis.analyzing")
    case "persisting_result":
      return t("analysis.savingResults")
    default:
      return t("analysis.analyzing")
  }
}
