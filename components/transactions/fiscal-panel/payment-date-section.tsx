"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { TransactionFiscalDocument } from "@/models/fiscal/transaction-fiscal"

import { LockedBanner, StatusFeedback } from "./shared"

type PaymentDateSectionProps = {
  transactionId: string
  document: TransactionFiscalDocument
  lockMessage: string | null
  action: (payload: FormData) => void
  pending: boolean
  state:
    | {
        success?: boolean
        error?: string | null
      }
    | null
}

export function PaymentDateSection({
  transactionId,
  document,
  lockMessage,
  action,
  pending,
  state,
}: PaymentDateSectionProps) {
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <div className="space-y-1">
        <h2 className="font-medium">Fecha de pago</h2>
        <p className="text-sm text-muted-foreground">
          La fecha de pago puede mover el IVA en caja y la retención al trimestre correspondiente.
        </p>
      </div>

      <LockedBanner message={lockMessage} />

      <form action={action} className="flex flex-col gap-3 md:flex-row md:items-end">
        <input type="hidden" name="sourceTransactionId" value={transactionId} />
        <input type="hidden" name="intent" value="save_payment_date" />

        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm font-medium">payment_date</span>
          <Input
            type="date"
            name="paymentDate"
            defaultValue={document.header.payment_date ?? ""}
            disabled={Boolean(lockMessage) || pending}
          />
        </label>

        <Button
          type="submit"
          disabled={Boolean(lockMessage) || pending}
          className="md:min-w-40"
        >
          {pending ? "Guardando..." : "Guardar fecha de pago"}
        </Button>
      </form>

      <StatusFeedback success={state?.success} error={state?.error} />
    </section>
  )
}
