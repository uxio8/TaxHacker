"use client"

import { BulkActionsMenu } from "@/components/transactions/bulk-actions"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { type Translator, useI18n } from "@/lib/i18n"
import { calcNetTotalPerCurrency, calcTotalPerCurrency } from "@/lib/stats"
import { cn, formatCurrency } from "@/lib/utils"
import type { TransactionAttentionSignal, TransactionListItem } from "@/models/transactions"
import type { Field } from "@/prisma/client"
import { formatDate } from "date-fns"
import { ArrowDownIcon, ArrowUpIcon, File } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

type FieldRenderer = {
  name: string
  code: string
  classes?: string
  sortable: boolean
  formatValue?: (transaction: TransactionListItem) => React.ReactNode
  footerValue?: (transactions: TransactionListItem[]) => React.ReactNode
}

type FieldWithRenderer = Field & {
  renderer: FieldRenderer
}

function getStandardFieldRenderers(t: Translator): Record<string, FieldRenderer> {
  return {
    name: {
      name: t("transactions.columns.name"),
      code: "name",
      classes: "font-medium min-w-[120px] max-w-[300px] overflow-hidden",
      sortable: true,
    },
    merchant: {
      name: t("transactions.columns.merchant"),
      code: "merchant",
      classes: "min-w-[120px] max-w-[250px] overflow-hidden",
      sortable: true,
    },
    issuedAt: {
      name: t("transactions.date"),
      code: "issuedAt",
      classes: "min-w-[100px]",
      sortable: true,
      formatValue: (transaction) => (transaction.issuedAt ? formatDate(transaction.issuedAt, "yyyy-MM-dd") : ""),
    },
    projectCode: {
      name: t("transactions.columns.project"),
      code: "projectCode",
      sortable: true,
      formatValue: (transaction) =>
        transaction.projectCode ? (
          <Badge className="whitespace-nowrap" style={{ backgroundColor: transaction.project?.color }}>
            {transaction.project?.name || ""}
          </Badge>
        ) : (
          "-"
        ),
    },
    categoryCode: {
      name: t("transactions.columns.category"),
      code: "categoryCode",
      sortable: true,
      formatValue: (transaction) =>
        transaction.categoryCode ? (
          <Badge className="whitespace-nowrap" style={{ backgroundColor: transaction.category?.color }}>
            {transaction.category?.name || ""}
          </Badge>
        ) : (
          <span className="text-amber-700">Sin categoría</span>
        ),
    },
    files: {
      name: t("transactions.columns.files"),
      code: "files",
      sortable: false,
      formatValue: (transaction) => (
        <div className="flex items-center gap-2 text-sm">
          <File className="h-4 w-4" />
          {(transaction.files as string[]).length}
        </div>
      ),
    },
    total: {
      name: t("transactions.columns.total"),
      code: "total",
      classes: "text-right",
      sortable: true,
      formatValue: (transaction) => (
        <div className="text-right text-lg">
          <div
            className={cn(
              { income: "text-green-500", expense: "text-red-500", other: "text-black" }[transaction.type || "other"],
              "flex flex-col justify-end"
            )}
          >
            <span>
              {transaction.total && transaction.currencyCode
                ? formatCurrency(transaction.total, transaction.currencyCode)
                : transaction.total}
            </span>
            {transaction.convertedTotal &&
              transaction.convertedCurrencyCode &&
              transaction.convertedCurrencyCode !== transaction.currencyCode && (
                <span className="text-sm -mt-1">
                  ({formatCurrency(transaction.convertedTotal, transaction.convertedCurrencyCode)})
                </span>
              )}
          </div>
        </div>
      ),
      footerValue: (transactions) => {
        const netTotalPerCurrency = calcNetTotalPerCurrency(transactions)
        const turnoverPerCurrency = calcTotalPerCurrency(transactions)

        return (
          <div className="flex flex-col gap-3 text-right">
            <dl className="space-y-1">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("transactions.netTotal")}
              </dt>
              {Object.entries(netTotalPerCurrency).map(([currency, total]) => (
                <dd
                  key={`net-${currency}`}
                  className={cn("text-sm first:text-base font-medium", total >= 0 ? "text-green-600" : "text-red-600")}
                >
                  {formatCurrency(total, currency)}
                </dd>
              ))}
            </dl>
            <dl className="space-y-1">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("transactions.turnover")}
              </dt>
              {Object.entries(turnoverPerCurrency).map(([currency, total]) => (
                <dd key={`turnover-${currency}`} className="text-sm text-muted-foreground">
                  {formatCurrency(total, currency)}
                </dd>
              ))}
            </dl>
          </div>
        )
      },
    },
    convertedTotal: {
      name: t("transactions.columns.convertedTotal"),
      code: "convertedTotal",
      classes: "text-right",
      sortable: true,
      formatValue: (transaction) => (
        <div
          className={cn(
            { income: "text-green-500", expense: "text-red-500", other: "text-black" }[transaction.type || "other"],
            "flex flex-col justify-end text-right text-lg"
          )}
        >
          {transaction.convertedTotal && transaction.convertedCurrencyCode
            ? formatCurrency(transaction.convertedTotal, transaction.convertedCurrencyCode)
            : transaction.convertedTotal}
        </div>
      ),
    },
    currencyCode: {
      name: t("transactions.columns.currency"),
      code: "currencyCode",
      classes: "text-right",
      sortable: true,
    },
  }
}

function getFieldRenderer(field: Field, standardFieldRenderers: Record<string, FieldRenderer>): FieldRenderer {
  if (standardFieldRenderers[field.code as keyof typeof standardFieldRenderers]) {
    return standardFieldRenderers[field.code as keyof typeof standardFieldRenderers]
  }

  return {
    name: field.name,
    code: field.code,
    classes: "",
    sortable: false,
  }
}

type TransactionListProps = {
  transactions: TransactionListItem[]
  fields?: Field[]
  attentionByTransactionId?: Record<string, TransactionAttentionSignal[]>
}

export function TransactionList({
  transactions,
  fields = [],
  attentionByTransactionId = {},
}: TransactionListProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const { t } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const standardFieldRenderers = getStandardFieldRenderers(t)

  const [sorting, setSorting] = useState<{ field: string | null; direction: "asc" | "desc" | null }>(() => {
    const ordering = searchParams.get("ordering")
    if (!ordering) {
      return { field: null, direction: null }
    }

    const isDesc = ordering.startsWith("-")
    return {
      field: isDesc ? ordering.slice(1) : ordering,
      direction: isDesc ? "desc" : "asc",
    }
  })

  const visibleFields: FieldWithRenderer[] = fields
    .filter((field) => field.isVisibleInList)
    .map((field) => ({
      ...field,
      renderer: getFieldRenderer(field, standardFieldRenderers),
    }))

  const toggleAllRows = () => {
    if (selectedIds.length === transactions.length) {
      setSelectedIds([])
      return
    }

    setSelectedIds(transactions.map((transaction) => transaction.id))
  }

  const toggleOneRow = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id))
      return
    }

    setSelectedIds([...selectedIds, id])
  }

  const handleSort = (field: string) => {
    let newDirection: "asc" | "desc" | null = "asc"

    if (sorting.field === field) {
      if (sorting.direction === "asc") {
        newDirection = "desc"
      } else if (sorting.direction === "desc") {
        newDirection = null
      }
    }

    setSorting({
      field: newDirection ? field : null,
      direction: newDirection,
    })
  }

  const renderFieldInTable = (transaction: TransactionListItem, field: FieldWithRenderer): string | React.ReactNode => {
    if (field.isExtra) {
      const extraValues = (transaction.extra ?? null) as Record<string, unknown> | null
      const value = extraValues?.[field.code]
      return value == null ? "" : String(value)
    }

    if (field.renderer.formatValue) {
      return field.renderer.formatValue(transaction)
    }

    return String(transaction[field.code as keyof TransactionListItem] ?? "")
  }

  const renderAttentionSignals = (attentionSignals: TransactionAttentionSignal[]) => {
    if (attentionSignals.length === 0) {
      return null
    }

    return (
      <div className="mt-1 flex flex-wrap gap-1">
        {attentionSignals.map((signal) => (
          <span
            key={signal.code}
            className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800"
          >
            {signal.label}
          </span>
        ))}
      </div>
    )
  }

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    if (sorting.field && sorting.direction) {
      params.set("ordering", sorting.direction === "desc" ? `-${sorting.field}` : sorting.field)
    } else {
      params.delete("ordering")
    }

    router.push(`/transactions?${params.toString()}`)
  }, [router, searchParams, sorting])

  const getSortIcon = (field: string) => {
    if (sorting.field !== field) {
      return null
    }

    if (sorting.direction === "asc") {
      return <ArrowUpIcon className="ml-1 inline h-4 w-4" />
    }

    if (sorting.direction === "desc") {
      return <ArrowDownIcon className="ml-1 inline h-4 w-4" />
    }

    return null
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[30px] select-none">
              <Checkbox checked={selectedIds.length === transactions.length} onCheckedChange={toggleAllRows} />
            </TableHead>
            {visibleFields.map((field) => (
              <TableHead
                key={field.code}
                className={cn(
                  field.renderer.classes,
                  field.renderer.sortable && "select-none hover:cursor-pointer hover:bg-accent"
                )}
                onClick={() => field.renderer.sortable && handleSort(field.code)}
              >
                {field.name || field.renderer.name}
                {field.renderer.sortable && getSortIcon(field.code)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((transaction) => {
            const attentionSignals = attentionByTransactionId[transaction.id] ?? []

            return (
              <TableRow
                key={transaction.id}
                className={cn(
                  attentionSignals.length > 0 && "bg-amber-50/40",
                  selectedIds.includes(transaction.id) && "bg-muted",
                  "cursor-pointer hover:bg-muted/50"
                )}
                onClick={() => router.push(`/transactions/${transaction.id}`)}
              >
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.includes(transaction.id)}
                    onCheckedChange={(checked) => {
                      if (checked !== "indeterminate") {
                        toggleOneRow(transaction.id)
                      }
                    }}
                  />
                </TableCell>
                {visibleFields.map((field, index) => (
                  <TableCell key={field.code} className={field.renderer.classes}>
                    {renderFieldInTable(transaction, field)}
                    {index === 0 && renderAttentionSignals(attentionSignals)}
                  </TableCell>
                ))}
              </TableRow>
            )
          })}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell></TableCell>
            {visibleFields.map((field) => (
              <TableCell key={field.code} className={field.renderer.classes}>
                {field.renderer.footerValue ? field.renderer.footerValue(transactions) : ""}
              </TableCell>
            ))}
          </TableRow>
        </TableFooter>
      </Table>
      {selectedIds.length > 0 && (
        <BulkActionsMenu selectedIds={selectedIds} onActionComplete={() => setSelectedIds([])} />
      )}
    </div>
  )
}
