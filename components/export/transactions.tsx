"use client"

import { DateRangePicker } from "@/components/forms/date-range-picker"
import { FormSelectCategory } from "@/components/forms/select-category"
import { FormSelectProject } from "@/components/forms/select-project"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { useDownload } from "@/hooks/use-download"
import { useI18n } from "@/lib/i18n"
import { useProgress } from "@/hooks/use-progress"
import { useTransactionFilters } from "@/hooks/use-transaction-filters"
import { Category, Field, Project } from "@/prisma/client"
import { formatDate } from "date-fns"
import { useState } from "react"

const deselectedFields = ["files", "text"]

export function ExportTransactionsDialog({
  fields,
  categories,
  projects,
  total,
  children,
}: {
  fields: Field[]
  categories: Category[]
  projects: Project[]
  total: number
  children: React.ReactNode
}) {
  const { t } = useI18n()
  const [exportFilters, setExportFilters] = useTransactionFilters()
  const [exportFields, setExportFields] = useState<string[]>(
    fields.map((field) => (deselectedFields.includes(field.code) ? "" : field.code))
  )
  const [includeAttachments, setIncludeAttachments] = useState(true)
  const { isLoading, startProgress, progress } = useProgress({
    onError: (error) => {
      console.error("Export progress error:", error)
    },
  })

  const { download, isDownloading } = useDownload({
    onError: (error) => {
      console.error("Download error:", error)
    },
  })

  const handleSubmit = async () => {
    try {
      const progressId = await startProgress("transactions-export")

      const exportUrl = `/export/transactions?${new URLSearchParams({
        search: exportFilters?.search || "",
        dateFrom: exportFilters?.dateFrom || "",
        dateTo: exportFilters?.dateTo || "",
        ordering: exportFilters?.ordering || "",
        categoryCode: exportFilters?.categoryCode || "",
        projectCode: exportFilters?.projectCode || "",
        fields: exportFields.join(","),
        includeAttachments: includeAttachments.toString(),
        progressId: progressId || "",
      }).toString()}`
      await download(exportUrl, "transactions.zip")
    } catch (error) {
      console.error("Failed to start export:", error)
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">{children}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{t("export.transactions.title", { total })}</DialogTitle>
          <DialogDescription>{t("export.transactions.description")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4">
            {exportFilters.search && (
              <div className="flex flex-row items-center gap-2">
                <span className="text-sm font-medium">{t("export.transactions.searchQuery")}</span>
                <span className="text-sm">{exportFilters.search}</span>
              </div>
            )}

            <div className="flex flex-row items-center gap-2">
              <span className="text-sm font-medium">{t("export.transactions.timeRange")}</span>

              <DateRangePicker
                defaultDate={{
                  from: exportFilters?.dateFrom ? new Date(exportFilters.dateFrom) : undefined,
                  to: exportFilters?.dateTo ? new Date(exportFilters.dateTo) : undefined,
                }}
                defaultRange="all-time"
                onChange={(date) => {
                  setExportFilters({
                    ...exportFilters,
                    dateFrom: date?.from ? formatDate(date.from, "yyyy-MM-dd") : undefined,
                    dateTo: date?.to ? formatDate(date.to, "yyyy-MM-dd") : undefined,
                  })
                }}
              />
            </div>

            <div className="flex flex-row items-center gap-2">
              <FormSelectCategory
                title={t("common.categories")}
                name="category"
                categories={categories}
                value={exportFilters.categoryCode}
                onValueChange={(value) => setExportFilters({ ...exportFilters, categoryCode: value })}
                placeholder={t("transactions.allCategories")}
                emptyValue={t("transactions.allCategories")}
              />

              <FormSelectProject
                title={t("common.projects")}
                name="project"
                projects={projects}
                value={exportFilters.projectCode}
                onValueChange={(value) => setExportFilters({ ...exportFilters, projectCode: value })}
                placeholder={t("transactions.allProjects")}
                emptyValue={t("transactions.allProjects")}
              />
            </div>
          </div>

          <Separator />

          <div className="text-lg font-bold">{t("export.transactions.fieldsIncluded")}</div>

          <div className="grid grid-cols-2 gap-2">
            {fields.map((field) => (
              <div key={field.code} className="inline-flex gap-2">
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    name={field.code}
                    checked={exportFields.includes(field.code)}
                    onChange={(e) =>
                      setExportFields(
                        e.target.checked ? [...exportFields, field.code] : exportFields.filter((f) => f !== field.code)
                      )
                    }
                  />
                  <span>{field.name}</span>
                </label>
              </div>
            ))}
          </div>
          <Separator />
          <div>
            <label className="flex items-center gap-3 text-lg">
              <input
                type="checkbox"
                name="attachments"
                className="h-[20px] w-[20px]"
                checked={includeAttachments}
                onChange={(e) => setIncludeAttachments(e.target.checked)}
              />
              <span className="flex flex-col">
                <span className="font-medium">{t("export.transactions.includeAttachedFiles")}</span>
                <span className="text-sm">{t("export.transactions.createZipArchive")}</span>
              </span>
            </label>
          </div>
        </div>
        <DialogFooter className="sm:justify-end">
          <Button type="button" onClick={handleSubmit} disabled={isLoading || isDownloading}>
            {isLoading
              ? progress?.current
                ? t("settings.backups.progress.archiving", {
                    current: progress.current,
                    total: progress.total,
                  })
                : t("export.transactions.exporting")
              : isDownloading
                ? t("settings.backups.progress.downloading")
                : t("export.transactions.exportAction")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
