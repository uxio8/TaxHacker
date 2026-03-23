"use client"

import { DateRangePicker } from "@/components/forms/date-range-picker"
import { ColumnSelector } from "@/components/transactions/fields-selector"
import { TransactionFilterQuickViews } from "@/components/transactions/quick-views"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  buildTransactionFilterSummary,
  isFiltered,
  useTransactionFilters,
} from "@/hooks/use-transaction-filters"
import { useI18n } from "@/lib/i18n"
import type { TransactionFilters, TransactionQuickViewOption } from "@/models/transactions"
import type { Category, Field, Project } from "@/prisma/client"
import { format } from "date-fns"
import { X } from "lucide-react"

type TransactionSearchAndFiltersProps = {
  categories: Category[]
  projects: Project[]
  fields: Field[]
  defaultFilters?: TransactionFilters
  quickViews: TransactionQuickViewOption[]
}

export function TransactionSearchAndFilters({
  categories,
  projects,
  fields,
  defaultFilters,
  quickViews,
}: TransactionSearchAndFiltersProps) {
  const [filters, setFilters] = useTransactionFilters(defaultFilters)
  const { t } = useI18n()

  const categoriesByCode = Object.fromEntries(categories.map((category) => [category.code, category.name]))
  const projectsByCode = Object.fromEntries(projects.map((project) => [project.code, project.name]))
  const activeFilterSummary = buildTransactionFilterSummary(filters, {
    categoriesByCode,
    projectsByCode,
    quickViews,
  })

  const handleFilterChange = (
    name: keyof TransactionFilters,
    value: TransactionFilters[keyof TransactionFilters]
  ) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [name]: value,
    }))
  }

  return (
    <div className="flex flex-col gap-4">
      <TransactionFilterQuickViews filters={filters} quickViews={quickViews} setFilters={setFilters} />

      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder={t("transactions.filters.search")}
            defaultValue={filters.search}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleFilterChange("search", (event.target as HTMLInputElement).value)
              }
            }}
            className="w-full"
          />
        </div>

        <Select value={filters.categoryCode} onValueChange={(value) => handleFilterChange("categoryCode", value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("transactions.allCategories")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="-">{t("transactions.allCategories")}</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.code} value={category.code}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: category.color }} />
                  {category.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {projects.length > 1 && (
          <Select value={filters.projectCode} onValueChange={(value) => handleFilterChange("projectCode", value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("transactions.allProjects")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="-">{t("transactions.allProjects")}</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.code} value={project.code}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
                    {project.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <DateRangePicker
          defaultDate={{
            from: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
            to: filters.dateTo ? new Date(filters.dateTo) : undefined,
          }}
          onChange={(date) => {
            handleFilterChange("dateFrom", date?.from ? format(date.from, "yyyy-MM-dd") : undefined)
            handleFilterChange("dateTo", date?.to ? format(date.to, "yyyy-MM-dd") : undefined)
          }}
        />

        {isFiltered(filters) && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setFilters({})
            }}
            className="text-muted-foreground hover:text-foreground"
            title={t("transactions.clearFilters")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}

        <ColumnSelector fields={fields} />
      </div>

      {activeFilterSummary.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground/80">Filtros activos</span>
          {activeFilterSummary.map((summaryItem) => (
            <span key={summaryItem} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
              {summaryItem}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
