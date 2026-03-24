"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { CounterpartyResolution } from "@/models/fiscal/counterparty-resolution"
import type { TransactionFiscalDocument } from "@/models/fiscal/transaction-fiscal"
import type { FiscalPanelCounterpartyOption } from "@/models/workflow/transaction-read-api"

import {
  AssignmentSummary,
  getCandidateMatchLabel,
  getCounterpartyResolutionDescription,
  StatusFeedback,
} from "./shared"

type CounterpartySectionProps = {
  transactionId: string
  document: TransactionFiscalDocument
  counterpartyOptions: FiscalPanelCounterpartyOption[]
  counterpartyResolution: CounterpartyResolution | null
  action: (payload: FormData) => void
  pending: boolean
  state:
    | {
        success?: boolean
        error?: string | null
        data?: TransactionFiscalDocument | null
      }
    | null
}

export function CounterpartySection({
  transactionId,
  document,
  counterpartyOptions,
  counterpartyResolution,
  action,
  pending,
  state,
}: CounterpartySectionProps) {
  const activeCounterpartyOptions = counterpartyOptions.filter((counterparty) => counterparty.isActive)
  const suggestedCandidate = counterpartyResolution?.relevant_candidates.find(
    (candidate) => candidate.is_active
  )
  const linkedCounterparty = activeCounterpartyOptions.find(
    (counterparty) => counterparty.id === document.header.counterparty_id
  )
  const counterpartyRequired = document.header.review_reasons.includes("missing_counterparty_relation")

  return (
    <section className="space-y-4 rounded-xl border p-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-medium">Resolver contraparte</h2>
          <span className="rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground">
            {counterpartyRequired ? "Obligatoria" : "Recomendada"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {getCounterpartyResolutionDescription(document, counterpartyResolution)}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <AssignmentSummary
          title="Detectado"
          periodKey={document.header.counterparty_name ?? "Sin nombre fiscal"}
          description={document.header.counterparty_tax_id ?? "Sin NIF detectado"}
        />
        <AssignmentSummary
          title="Vínculo actual"
          periodKey={linkedCounterparty?.displayName ?? document.header.counterparty_id ?? "Sin enlazar"}
          description={linkedCounterparty?.taxId ?? "Sin contraparte canónica"}
        />
        <AssignmentSummary
          title="Sugerencia"
          periodKey={suggestedCandidate?.display_name ?? "Sin sugerencia segura"}
          description={
            suggestedCandidate
              ? getCandidateMatchLabel(suggestedCandidate.match_reasons)
              : counterpartyResolution?.evidence.conflict_reason ?? "Sin candidata activa"
          }
        />
      </div>

      {suggestedCandidate && !document.header.counterparty_id && (
        <form action={action} className="flex flex-wrap gap-3">
          <input type="hidden" name="sourceTransactionId" value={transactionId} />
          <input type="hidden" name="intent" value="link_counterparty" />
          <input type="hidden" name="counterpartyId" value={suggestedCandidate.id} />
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando..." : "Confirmar sugerencia"}
          </Button>
        </form>
      )}

      <form action={action} className="space-y-3 rounded-lg border bg-muted/10 p-4">
        <input type="hidden" name="sourceTransactionId" value={transactionId} />

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Elegir contraparte existente</span>
          <select
            name="counterpartyId"
            defaultValue={document.header.counterparty_id ?? suggestedCandidate?.id ?? ""}
            disabled={pending}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Selecciona una contraparte activa</option>
            {activeCounterpartyOptions.map((counterparty) => (
              <option key={counterparty.id} value={counterparty.id}>
                {counterparty.displayName}
                {counterparty.taxId ? ` · ${counterparty.taxId}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Motivo interno (opcional)</span>
          <textarea
            name="counterpartyResolutionNote"
            aria-label="Motivo interno (opcional)"
            rows={3}
            disabled={pending}
            placeholder="Deja contexto interno si rechazas la sugerencia o fuerzas otro vínculo."
            className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" name="intent" value="link_counterparty" disabled={pending}>
            {pending ? "Guardando..." : "Confirmar contraparte"}
          </Button>
          <Button
            type="submit"
            name="intent"
            value="keep_counterparty_in_review"
            variant="outline"
            disabled={pending}
          >
            Mantener en revisión
          </Button>
        </div>
      </form>

      <form
        action={action}
        className="grid gap-3 rounded-lg border bg-muted/10 p-4 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end"
      >
        <input type="hidden" name="sourceTransactionId" value={transactionId} />
        <input type="hidden" name="intent" value="create_counterparty_and_link" />

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Nueva contraparte</span>
          <Input
            name="counterpartyDisplayName"
            defaultValue={document.header.counterparty_name ?? ""}
            placeholder="Nombre fiscal de la contraparte"
            disabled={pending}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">NIF</span>
          <Input
            name="counterpartyTaxId"
            defaultValue={document.header.counterparty_tax_id ?? ""}
            placeholder="B12345678"
            disabled={pending}
          />
        </label>

        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-sm font-medium">Motivo interno (opcional)</span>
          <textarea
            name="counterpartyResolutionNote"
            aria-label="Motivo interno (opcional)"
            rows={3}
            disabled={pending}
            placeholder="Anota por qué creas una contraparte nueva o sustituyes la sugerencia."
            className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>

        <Button type="submit" disabled={pending}>
          {pending ? "Guardando..." : "Crear y enlazar"}
        </Button>
      </form>

      <StatusFeedback success={state?.success} error={state?.error} />
    </section>
  )
}
