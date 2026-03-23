"use client"

import { saveTransactionFiscalPanelAction } from "@/app/(app)/transactions/fiscal-actions"
import { FormError } from "@/components/forms/error"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { CounterpartyResolution } from "@/models/fiscal/counterparty-resolution"
import type { TransactionFiscalDocument } from "@/models/fiscal/transaction-fiscal"
import { CircleCheckBig, LockKeyhole } from "lucide-react"
import { useActionState } from "react"

type FiscalPanelPeriodOption = {
  periodKey: string
  label: string
  status: string | null
}

type FiscalPanelCounterpartyOption = {
  id: string
  displayName: string
  taxId: string | null
  isActive: boolean
}

type FiscalPanelProps = {
  transactionId: string
  profileStatus: "ready" | "profile_missing" | "storage_not_ready"
  document: TransactionFiscalDocument | null
  periodOptions: FiscalPanelPeriodOption[]
  paymentDateLockMessage: string | null
  vatLockMessage: string | null
  withholdingLockMessage: string | null
  counterpartyOptions: FiscalPanelCounterpartyOption[]
  counterpartyResolution: CounterpartyResolution | null
}

function getBasisLabel(basis?: string | null) {
  if (basis === "issue_date") {
    return "Fecha de emisión"
  }

  if (basis === "operation_date") {
    return "Fecha de operación"
  }

  if (basis === "payment_date") {
    return "Fecha de pago"
  }

  if (basis === "manual_override") {
    return "Override manual"
  }

  return "Sin asignación"
}

function getDocumentKindLabel(documentKind?: string | null) {
  if (documentKind === "received_invoice") {
    return "Factura recibida"
  }

  if (documentKind === "issued_invoice") {
    return "Factura emitida"
  }

  if (documentKind === "payroll_placeholder") {
    return "Placeholder de nómina"
  }

  return "Documento fiscal"
}

function StatusFeedback({
  success,
  error,
}: {
  success?: boolean
  error?: string | null
}) {
  if (error) {
    return <FormError>{error}</FormError>
  }

  if (!success) {
    return null
  }

  return (
    <p className="flex items-center gap-2 text-sm text-green-600">
      <CircleCheckBig className="h-4 w-4" />
      Cambios guardados.
    </p>
  )
}

function LockedBanner({ message }: { message: string | null }) {
  if (!message) {
    return null
  }

  return (
    <Alert>
      <LockKeyhole className="h-4 w-4" />
      <AlertTitle>Edición bloqueada</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

function AssignmentSummary({
  title,
  periodKey,
  description,
}: {
  title: string
  periodKey?: string | null
  description: string
}) {
  return (
    <div className="space-y-1 rounded-lg border bg-muted/20 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="text-sm font-medium">{periodKey ?? "Automático pendiente"}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  )
}

function getCounterpartyResolutionDescription(
  document: TransactionFiscalDocument,
  resolution: CounterpartyResolution | null
) {
  const requiresConfirmedLink = document.header.review_reasons.includes("missing_counterparty_relation")

  if (document.header.counterparty_id) {
    return "La evidencia fiscal del documento ya está enlazada con una contraparte canónica."
  }

  if (!document.header.counterparty_name && !document.header.counterparty_tax_id) {
    return "Faltan datos identificativos fiscales de la contraparte. Revisa nombre y NIF antes de confirmar un vínculo."
  }

  if (requiresConfirmedLink) {
    return "Este documento necesita una contraparte confirmada antes de entrar en el flujo fiscal sensible."
  }

  if (resolution?.decision === "suggested_requires_confirmation") {
    return "Hemos encontrado una posible contraparte, pero no es seguro enlazarla automáticamente. Revísala antes de confirmar."
  }

  return "La contraparte del documento está identificada, pero falta confirmar su vínculo con una contraparte canónica de la plataforma."
}

function getCandidateMatchLabel(matchReasons: string[]) {
  if (matchReasons.includes("tax_id_exact")) {
    return "Coincidencia exacta por NIF"
  }

  if (matchReasons.includes("name_exact")) {
    return "Coincidencia exacta por nombre"
  }

  return "Coincidencia sugerida"
}

export function FiscalPanel({
  transactionId,
  profileStatus,
  document,
  periodOptions,
  paymentDateLockMessage,
  vatLockMessage,
  withholdingLockMessage,
  counterpartyOptions,
  counterpartyResolution,
}: FiscalPanelProps) {
  const [paymentState, paymentAction, paymentPending] = useActionState(
    saveTransactionFiscalPanelAction,
    null
  )
  const [vatState, vatAction, vatPending] = useActionState(saveTransactionFiscalPanelAction, null)
  const [withholdingState, withholdingAction, withholdingPending] = useActionState(
    saveTransactionFiscalPanelAction,
    null
  )
  const [counterpartyState, counterpartyAction, counterpartyPending] = useActionState(
    saveTransactionFiscalPanelAction,
    null
  )

  if (profileStatus === "storage_not_ready") {
    return (
      <Card className="mt-8 border-dashed">
        <CardHeader>
          <CardTitle>Panel fiscal</CardTitle>
          <CardDescription>El almacenamiento fiscal todavía no está listo.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (profileStatus === "profile_missing") {
    return (
      <Card className="mt-8 border-dashed">
        <CardHeader>
          <CardTitle>Panel fiscal</CardTitle>
          <CardDescription>
            Configura primero el perfil fiscal para ver y editar la proyección tributaria.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!document) {
    return (
      <Card className="mt-8 border-dashed">
        <CardHeader>
          <CardTitle>Panel fiscal</CardTitle>
          <CardDescription>
            Esta transacción todavía no tiene un documento fiscal asociado. Cuando exista, podrás
            revisar aquí la fecha de pago y los overrides por obligación.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const currentDocument =
    counterpartyState?.data ??
    withholdingState?.data ??
    vatState?.data ??
    paymentState?.data ??
    document
  const activeCounterpartyOptions = counterpartyOptions.filter((counterparty) => counterparty.isActive)
  const suggestedCandidate = counterpartyResolution?.relevant_candidates.find(
    (candidate) => candidate.is_active
  )
  const linkedCounterparty = activeCounterpartyOptions.find(
    (counterparty) => counterparty.id === currentDocument.header.counterparty_id
  )
  const counterpartyRequired = currentDocument.header.review_reasons.includes(
    "missing_counterparty_relation"
  )

  return (
    <Card className="mt-8 border-slate-200">
      <CardHeader className="gap-3">
        <div className="space-y-1">
          <CardTitle>Panel fiscal</CardTitle>
          <CardDescription>
            Ajusta la fecha de pago y los trimestres por obligación sin salir del detalle de la
            transacción.
          </CardDescription>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <AssignmentSummary
            title="Documento"
            periodKey={currentDocument.header.fiscal_document_id}
            description={getDocumentKindLabel(currentDocument.header.document_kind)}
          />
          <AssignmentSummary
            title="IVA"
            periodKey={currentDocument.header.vat_period_assignment?.period_key}
            description={`Base actual: ${getBasisLabel(currentDocument.header.vat_period_assignment?.basis)}`}
          />
          <AssignmentSummary
            title="Retenciones"
            periodKey={currentDocument.header.withholding_period_assignment?.period_key}
            description={`Base actual: ${getBasisLabel(currentDocument.header.withholding_period_assignment?.basis)}`}
          />
        </div>

        <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
          <p>Tipo: {getDocumentKindLabel(currentDocument.header.document_kind)}</p>
          <p>Estado fiscal: {currentDocument.header.review_status}</p>
          <p>Transacción origen: {transactionId}</p>
          <p>Fecha de emisión: {currentDocument.header.issue_date ?? "Sin fecha"}</p>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <section className="space-y-4 rounded-xl border p-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-medium">Resolver contraparte</h2>
              <span className="rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground">
                {counterpartyRequired ? "Obligatoria" : "Recomendada"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {getCounterpartyResolutionDescription(currentDocument, counterpartyResolution)}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <AssignmentSummary
              title="Detectado"
              periodKey={currentDocument.header.counterparty_name ?? "Sin nombre fiscal"}
              description={currentDocument.header.counterparty_tax_id ?? "Sin NIF detectado"}
            />
            <AssignmentSummary
              title="Vínculo actual"
              periodKey={linkedCounterparty?.displayName ?? currentDocument.header.counterparty_id ?? "Sin enlazar"}
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

          {suggestedCandidate && !currentDocument.header.counterparty_id && (
            <form action={counterpartyAction} className="flex flex-wrap gap-3">
              <input type="hidden" name="sourceTransactionId" value={transactionId} />
              <input type="hidden" name="intent" value="link_counterparty" />
              <input type="hidden" name="counterpartyId" value={suggestedCandidate.id} />
              <Button type="submit" disabled={counterpartyPending}>
                {counterpartyPending ? "Guardando..." : "Confirmar sugerencia"}
              </Button>
            </form>
          )}

          <form action={counterpartyAction} className="space-y-3 rounded-lg border bg-muted/10 p-4">
            <input type="hidden" name="sourceTransactionId" value={transactionId} />

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Elegir contraparte existente</span>
              <select
                name="counterpartyId"
                defaultValue={currentDocument.header.counterparty_id ?? suggestedCandidate?.id ?? ""}
                disabled={counterpartyPending}
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

            <div className="flex flex-wrap gap-3">
              <Button type="submit" name="intent" value="link_counterparty" disabled={counterpartyPending}>
                {counterpartyPending ? "Guardando..." : "Confirmar contraparte"}
              </Button>
              <Button
                type="submit"
                name="intent"
                value="keep_counterparty_in_review"
                variant="outline"
                disabled={counterpartyPending}
              >
                Mantener en revisión
              </Button>
            </div>
          </form>

          <form action={counterpartyAction} className="grid gap-3 rounded-lg border bg-muted/10 p-4 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end">
            <input type="hidden" name="sourceTransactionId" value={transactionId} />
            <input type="hidden" name="intent" value="create_counterparty_and_link" />

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Nueva contraparte</span>
              <Input
                name="counterpartyDisplayName"
                defaultValue={currentDocument.header.counterparty_name ?? ""}
                placeholder="Nombre fiscal de la contraparte"
                disabled={counterpartyPending}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">NIF</span>
              <Input
                name="counterpartyTaxId"
                defaultValue={currentDocument.header.counterparty_tax_id ?? ""}
                placeholder="B12345678"
                disabled={counterpartyPending}
              />
            </label>

            <Button type="submit" disabled={counterpartyPending}>
              {counterpartyPending ? "Guardando..." : "Crear y enlazar"}
            </Button>
          </form>

          <StatusFeedback success={counterpartyState?.success} error={counterpartyState?.error} />
        </section>

        <section className="space-y-3 rounded-xl border p-4">
          <div className="space-y-1">
            <h2 className="font-medium">Fecha de pago</h2>
            <p className="text-sm text-muted-foreground">
              La fecha de pago puede mover el IVA en caja y la retención al trimestre
              correspondiente.
            </p>
          </div>

          <LockedBanner message={paymentDateLockMessage} />

          <form action={paymentAction} className="flex flex-col gap-3 md:flex-row md:items-end">
            <input type="hidden" name="sourceTransactionId" value={transactionId} />
            <input type="hidden" name="intent" value="save_payment_date" />

            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm font-medium">payment_date</span>
              <Input
                type="date"
                name="paymentDate"
                defaultValue={currentDocument.header.payment_date ?? ""}
                disabled={Boolean(paymentDateLockMessage) || paymentPending}
              />
            </label>

            <Button
              type="submit"
              disabled={Boolean(paymentDateLockMessage) || paymentPending}
              className="md:min-w-40"
            >
              {paymentPending ? "Guardando..." : "Guardar fecha de pago"}
            </Button>
          </form>

          <StatusFeedback success={paymentState?.success} error={paymentState?.error} />
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-3 rounded-xl border p-4">
            <div className="space-y-1">
              <h2 className="font-medium">Override de IVA</h2>
              <p className="text-sm text-muted-foreground">
                Basis actual: {getBasisLabel(currentDocument.header.vat_period_assignment?.basis)}
              </p>
            </div>

            <LockedBanner message={vatLockMessage} />

            <form action={vatAction} className="space-y-3">
              <input type="hidden" name="sourceTransactionId" value={transactionId} />

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">Trimestre manual de IVA</span>
                <select
                  name="periodKey"
                  defaultValue={currentDocument.header.vat_period_assignment?.period_key ?? ""}
                  disabled={Boolean(vatLockMessage) || vatPending}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecciona un trimestre</option>
                  {periodOptions.map((period) => (
                    <option
                      key={`vat-${period.periodKey}`}
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
                  value="override_vat_manual"
                  disabled={Boolean(vatLockMessage) || vatPending}
                >
                  {vatPending ? "Guardando..." : "Guardar override IVA"}
                </Button>
                <Button
                  type="submit"
                  name="intent"
                  value="reset_vat_automatic"
                  variant="outline"
                  disabled={Boolean(vatLockMessage) || vatPending}
                >
                  Volver a automático
                </Button>
              </div>
            </form>

            <StatusFeedback success={vatState?.success} error={vatState?.error} />
          </div>

          <div className="space-y-3 rounded-xl border p-4">
            <div className="space-y-1">
              <h2 className="font-medium">Override de retenciones</h2>
              <p className="text-sm text-muted-foreground">
                Basis actual: {getBasisLabel(currentDocument.header.withholding_period_assignment?.basis)}
              </p>
            </div>

            <LockedBanner message={withholdingLockMessage} />

            <form action={withholdingAction} className="space-y-3">
              <input type="hidden" name="sourceTransactionId" value={transactionId} />

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">Trimestre manual de retenciones</span>
                <select
                  name="periodKey"
                  defaultValue={currentDocument.header.withholding_period_assignment?.period_key ?? ""}
                  disabled={Boolean(withholdingLockMessage) || withholdingPending}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecciona un trimestre</option>
                  {periodOptions.map((period) => (
                    <option
                      key={`withholding-${period.periodKey}`}
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
                  value="override_withholding_manual"
                  disabled={Boolean(withholdingLockMessage) || withholdingPending}
                >
                  {withholdingPending ? "Guardando..." : "Guardar override retenciones"}
                </Button>
                <Button
                  type="submit"
                  name="intent"
                  value="reset_withholding_automatic"
                  variant="outline"
                  disabled={Boolean(withholdingLockMessage) || withholdingPending}
                >
                  Volver a automático
                </Button>
              </div>
            </form>

            <StatusFeedback
              success={withholdingState?.success}
              error={withholdingState?.error}
            />
          </div>
        </section>
      </CardContent>
    </Card>
  )
}
