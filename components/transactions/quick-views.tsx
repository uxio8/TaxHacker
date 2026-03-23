"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { TransactionFilters, TransactionQuickViewOption } from "@/models/transactions"
import type { Dispatch, SetStateAction } from "react"

type TransactionFilterQuickViewsProps = {
  filters: TransactionFilters
  quickViews: TransactionQuickViewOption[]
  setFilters: Dispatch<SetStateAction<TransactionFilters>>
}

export function TransactionFilterQuickViews({
  filters,
  quickViews,
  setFilters,
}: TransactionFilterQuickViewsProps) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      {quickViews.map((quickView) => {
        const isActive = filters.quickView === quickView.code

        return (
          <Button
            key={quickView.code}
            type="button"
            variant={isActive ? "default" : "outline"}
            size="sm"
            onClick={() =>
              setFilters((currentFilters) => ({
                ...currentFilters,
                quickView: currentFilters.quickView === quickView.code ? undefined : quickView.code,
              }))
            }
            className={cn("h-auto min-h-9 px-3 py-2 text-left", !isActive && "text-muted-foreground")}
          >
            <span className="flex flex-col items-start leading-tight">
              <span className="font-medium">{quickView.label}</span>
              <span className="text-[11px] opacity-80">{quickView.description}</span>
            </span>
          </Button>
        )
      })}
    </div>
  )
}
