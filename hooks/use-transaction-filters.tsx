import type { TransactionFilters, TransactionQuickViewOption } from "@/models/transactions"
import { format } from "date-fns"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

type TransactionFilterKey = keyof TransactionFilters

const filterKeys: TransactionFilterKey[] = [
  "search",
  "dateFrom",
  "dateTo",
  "ordering",
  "categoryCode",
  "projectCode",
  "type",
  "quickView",
]

type TransactionFilterSummaryOptions = {
  categoriesByCode?: Record<string, string>
  projectsByCode?: Record<string, string>
  quickViews?: TransactionQuickViewOption[]
}

export function useTransactionFilters(defaultFilters?: TransactionFilters) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const searchParamsString = searchParams.toString()
  const [filters, setFilters] = useState<TransactionFilters>({
    ...defaultFilters,
    ...searchParamsToFilters(searchParams),
  })

  useEffect(() => {
    const currentParams = new URLSearchParams(searchParamsString)
    const nextSearchParams = filtersToSearchParams(filters, currentParams)
    const currentNormalizedSearchParams = filtersToSearchParams(searchParamsToFilters(currentParams), currentParams)

    if (nextSearchParams.toString() === currentNormalizedSearchParams.toString()) {
      return
    }

    const nextQuery = nextSearchParams.toString()
    router.replace(nextQuery ? `?${nextQuery}` : "?")
  }, [filters, router, searchParamsString])

  useEffect(() => {
    const nextFilters = {
      ...defaultFilters,
      ...searchParamsToFilters(new URLSearchParams(searchParamsString)),
    }

    setFilters((currentFilters) => (areFiltersEqual(currentFilters, nextFilters) ? currentFilters : nextFilters))
  }, [defaultFilters, searchParamsString])

  return [filters, setFilters] as const
}

export function searchParamsToFilters(searchParams: URLSearchParams) {
  return filterKeys.reduce((acc, filter) => {
    acc[filter] = searchParams.get(filter) || ""
    return acc
  }, {} as Record<string, string>) as TransactionFilters
}

export function filtersToSearchParams(
  filters: TransactionFilters,
  currentSearchParams?: URLSearchParams
): URLSearchParams {
  const searchParams = new URLSearchParams()

  if (currentSearchParams) {
    currentSearchParams.forEach((value, key) => {
      if (!filterKeys.includes(key as TransactionFilterKey)) {
        searchParams.set(key, value)
      }
    })
  }

  searchParams.delete("page")

  if (filters.search) {
    searchParams.set("search", filters.search)
  } else {
    searchParams.delete("search")
  }

  if (filters.dateFrom) {
    searchParams.set("dateFrom", format(new Date(filters.dateFrom), "yyyy-MM-dd"))
  } else {
    searchParams.delete("dateFrom")
  }

  if (filters.dateTo) {
    searchParams.set("dateTo", format(new Date(filters.dateTo), "yyyy-MM-dd"))
  } else {
    searchParams.delete("dateTo")
  }

  if (filters.ordering) {
    searchParams.set("ordering", filters.ordering)
  } else {
    searchParams.delete("ordering")
  }

  if (filters.categoryCode && filters.categoryCode !== "-") {
    searchParams.set("categoryCode", filters.categoryCode)
  } else {
    searchParams.delete("categoryCode")
  }

  if (filters.projectCode && filters.projectCode !== "-") {
    searchParams.set("projectCode", filters.projectCode)
  } else {
    searchParams.delete("projectCode")
  }

  if (filters.type && filters.type !== "-") {
    searchParams.set("type", filters.type)
  } else {
    searchParams.delete("type")
  }

  if (filters.quickView) {
    searchParams.set("quickView", filters.quickView)
  } else {
    searchParams.delete("quickView")
  }

  return searchParams
}

export function buildTransactionFilterSummary(
  filters: TransactionFilters,
  options: TransactionFilterSummaryOptions = {}
) {
  const summary: string[] = []
  const quickViewLabel = options.quickViews?.find((option) => option.code === filters.quickView)?.label

  if (quickViewLabel) {
    summary.push(quickViewLabel)
  }

  if (filters.search) {
    summary.push(`Búsqueda: ${filters.search}`)
  }

  if (filters.categoryCode && filters.categoryCode !== "-") {
    summary.push(`Categoría: ${options.categoriesByCode?.[filters.categoryCode] ?? filters.categoryCode}`)
  }

  if (filters.projectCode && filters.projectCode !== "-") {
    summary.push(`Proyecto: ${options.projectsByCode?.[filters.projectCode] ?? filters.projectCode}`)
  }

  if (filters.dateFrom || filters.dateTo) {
    if (filters.dateFrom && filters.dateTo) {
      summary.push(`Fecha: ${filters.dateFrom} a ${filters.dateTo}`)
    } else if (filters.dateFrom) {
      summary.push(`Desde: ${filters.dateFrom}`)
    } else if (filters.dateTo) {
      summary.push(`Hasta: ${filters.dateTo}`)
    }
  }

  return summary
}

export function isFiltered(filters: TransactionFilters) {
  return Object.values(filters).some((value) => value !== "" && value !== "-")
}

function areFiltersEqual(left: TransactionFilters, right: TransactionFilters) {
  return filterKeys.every((key) => (left[key] || "") === (right[key] || ""))
}
