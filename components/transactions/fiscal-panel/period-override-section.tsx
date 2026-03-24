"use client"

import { Button } from "@/components/ui/button"
import type { FiscalPanelPeriodOption } from "@/models/workflow/transaction-read-api"

import { LockedBanner, StatusFeedback } from "./shared"

type PeriodOverrideSectionProps = {
  transactionId: string
  title: string
  summary: string
  periodOptions: FiscalPanelPeriodOption[]
  selectedPeriodKey: string | null | undefined
  lockMessage: string | null
  action: (payload: FormData) => void
  pending: boolean
  submitIntent: string
  resetIntent: string
  submitLabel: string
  state:
    | {
        success?: boolean
        error?: string | null
      }
    | null
}

export function PeriodOverrideSection({
  transactionId,
  title,
  summary,
  periodOptions,
  selectedPeriodKey,
  lockMessage,
  action,
  pending,
  submitIntent,
  resetIntent,
  submitLabel,
  state,
}: PeriodOverrideSectionProps) {
  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="space-y-1">
        <h2 className="font-medium">{title}</h2>
        <p className="text-sm text-muted-foreground">{summary}</p>
      </div>

      <LockedBanner message={lockMessage} />

      <form action={action} className="space-y-3">
        <input type="hidden" name="sourceTransactionId" value={transactionId} />

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Trimestre manual</span>
          <select
            name="periodKey"
            defaultValue={selectedPeriodKey ?? ""}
            disabled={Boolean(lockMessage) || pending}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Selecciona un trimestre</option>
            {periodOptions.map((period) => (
              <option
                key={`${submitIntent}-${period.periodKey}`}
                value={period.periodKey}
                disabled={period.status === "closed" || period.status === "presented"}
              >
                {period.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            name="intent"
            value={submitIntent}
            disabled={Boolean(lockMessage) || pending}
          >
            {pending ? "Guardando..." : submitLabel}
          </Button>
          <Button
            type="submit"
            name="intent"
            value={resetIntent}
            variant="outline"
            disabled={Boolean(lockMessage) || pending}
          >
            Volver a automático
          </Button>
        </div>
      </form>

      <StatusFeedback success={state?.success} error={state?.error} />
    </div>
  )
}
