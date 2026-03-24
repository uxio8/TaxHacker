"use client"

import { CurrencyConverterTool } from "@/components/agents/currency-converter"
import { ItemsDetectTool } from "@/components/agents/items-detect"
import ToolWindow from "@/components/agents/tool-window"
import { FormError } from "@/components/forms/error"
import { FormSelectCategory } from "@/components/forms/select-category"
import { FormSelectCurrency } from "@/components/forms/select-currency"
import { FormSelectProject } from "@/components/forms/select-project"
import { FormSelectType } from "@/components/forms/select-type"
import { FormInput, FormTextarea } from "@/components/forms/simple"
import { Button } from "@/components/ui/button"
import { buildAnalyzeFormState } from "@/components/unsorted/analyze-form-state"
import type { AnalyzeFormFieldMap } from "@/components/unsorted/analyze-form/derived-state"
import type { Translator } from "@/lib/i18n"
import type { Category, Currency, Field, File, Project } from "@/prisma/client"
import { format } from "date-fns"
import { ArrowDownToLine, Loader2, Trash2 } from "lucide-react"
import type { Dispatch, SetStateAction } from "react"

type AnalyzeFormData = ReturnType<typeof buildAnalyzeFormState>

export function AnalyzeFormDetails({
  file,
  categories,
  projects,
  currencies,
  settings,
  fieldMap,
  invoiceFields,
  issuerFields,
  remainingExtraFields,
  formData,
  isDeleting,
  isSaving,
  saveError,
  onDelete,
  onFormDataChange,
  t,
}: {
  file: File
  categories: Category[]
  projects: Project[]
  currencies: Currency[]
  settings: Record<string, string>
  fieldMap: AnalyzeFormFieldMap
  invoiceFields: Field[]
  issuerFields: Field[]
  remainingExtraFields: Field[]
  formData: AnalyzeFormData
  isDeleting: boolean
  isSaving: boolean
  saveError: string
  onDelete: () => void
  onFormDataChange: Dispatch<SetStateAction<AnalyzeFormData>>
  t: Translator
}) {
  return (
    <>
      <FormInput
        title={fieldMap.name.name}
        name="name"
        value={formData.name}
        onChange={(e) => onFormDataChange((prev) => ({ ...prev, name: e.target.value }))}
        required={fieldMap.name.isRequired}
      />

      <FormInput
        title={fieldMap.merchant.name}
        name="merchant"
        value={formData.merchant}
        onChange={(e) => onFormDataChange((prev) => ({ ...prev, merchant: e.target.value }))}
        hideIfEmpty={!fieldMap.merchant.isVisibleInAnalysis}
        required={fieldMap.merchant.isRequired}
      />

      <FormInput
        title={fieldMap.description.name}
        name="description"
        value={formData.description}
        onChange={(e) => onFormDataChange((prev) => ({ ...prev, description: e.target.value }))}
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
            if (!isNaN(newValue)) {
              onFormDataChange((prev) => ({ ...prev, total: newValue }))
            }
          }}
          className="w-32"
          required={fieldMap.total.isRequired}
        />

        <FormSelectCurrency
          title={fieldMap.currencyCode.name}
          currencies={currencies}
          name="currencyCode"
          value={formData.currencyCode}
          onValueChange={(value) => onFormDataChange((prev) => ({ ...prev, currencyCode: value }))}
          hideIfEmpty={!fieldMap.currencyCode.isVisibleInAnalysis}
          required={fieldMap.currencyCode.isRequired}
        />

        <FormSelectType
          title={fieldMap.type.name}
          name="type"
          value={formData.type}
          onValueChange={(value) => onFormDataChange((prev) => ({ ...prev, type: value }))}
          hideIfEmpty={!fieldMap.type.isVisibleInAnalysis}
          required={fieldMap.type.isRequired}
        />
      </div>

      {formData.total != 0 && formData.currencyCode && formData.currencyCode !== settings.default_currency ? (
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
            onChange={(value) => onFormDataChange((prev) => ({ ...prev, convertedTotal: value }))}
          />
          <input type="hidden" name="convertedCurrencyCode" value={settings.default_currency} />
        </ToolWindow>
      ) : null}

      <div className="flex flex-row gap-4">
        <FormInput
          title={fieldMap.issuedAt.name}
          type="date"
          name="issuedAt"
          value={formData.issuedAt}
          onChange={(e) => onFormDataChange((prev) => ({ ...prev, issuedAt: e.target.value }))}
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
          onValueChange={(value) => onFormDataChange((prev) => ({ ...prev, categoryCode: value }))}
          placeholder={t("analysis.selectCategory")}
          hideIfEmpty={!fieldMap.categoryCode.isVisibleInAnalysis}
          required={fieldMap.categoryCode.isRequired}
        />

        {projects.length > 0 ? (
          <FormSelectProject
            title={fieldMap.projectCode.name}
            projects={projects}
            name="projectCode"
            value={formData.projectCode}
            onValueChange={(value) => onFormDataChange((prev) => ({ ...prev, projectCode: value }))}
            placeholder={t("analysis.selectProject")}
            hideIfEmpty={!fieldMap.projectCode.isVisibleInAnalysis}
            required={fieldMap.projectCode.isRequired}
          />
        ) : null}
      </div>

      <FormInput
        title={fieldMap.note.name}
        name="note"
        value={formData.note}
        onChange={(e) => onFormDataChange((prev) => ({ ...prev, note: e.target.value }))}
        hideIfEmpty={!fieldMap.note.isVisibleInAnalysis}
        required={fieldMap.note.isRequired}
      />

      {invoiceFields.length > 0 ? (
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
              onChange={(e) => onFormDataChange((prev) => ({ ...prev, [field.code]: e.target.value }))}
              hideIfEmpty={!field.isVisibleInAnalysis}
              required={field.isRequired}
            />
          ))}
        </div>
      ) : null}

      {issuerFields.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {t("analysis.sectionBillingDetails")}
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {issuerFields.map((field) => (
              <FormInput
                key={field.code}
                type="text"
                title={field.name}
                name={field.code}
                value={formData[field.code as keyof typeof formData]}
                onChange={(e) => onFormDataChange((prev) => ({ ...prev, [field.code]: e.target.value }))}
                hideIfEmpty={!field.isVisibleInAnalysis}
                required={field.isRequired}
              />
            ))}
          </div>
        </div>
      ) : null}

      {remainingExtraFields.map((field) => (
        <FormInput
          key={field.code}
          type="text"
          title={field.name}
          name={field.code}
          value={formData[field.code as keyof typeof formData]}
          onChange={(e) => onFormDataChange((prev) => ({ ...prev, [field.code]: e.target.value }))}
          hideIfEmpty={!field.isVisibleInAnalysis}
          required={field.isRequired}
        />
      ))}

      {formData.items && formData.items.length > 0 ? (
        <ToolWindow title={t("analysis.detectedItems")}>
          <ItemsDetectTool file={file} data={formData} />
        </ToolWindow>
      ) : null}

      <div className="hidden">
        <input type="text" name="items" value={JSON.stringify(formData.items)} readOnly />
        <FormTextarea
          title={fieldMap.text.name}
          name="text"
          value={formData.text}
          onChange={(e) => onFormDataChange((prev) => ({ ...prev, text: e.target.value }))}
          hideIfEmpty={!fieldMap.text.isVisibleInAnalysis}
        />
      </div>

      <div className="flex justify-between gap-4 pt-6">
        <Button type="button" onClick={onDelete} variant="destructive" disabled={isDeleting}>
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

      <div>{saveError ? <FormError>{saveError}</FormError> : null}</div>
    </>
  )
}
