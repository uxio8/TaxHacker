"use client"

import { FormError } from "@/components/forms/error"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CircleCheckBig, LockKeyhole } from "lucide-react"
import type { CounterpartyResolution } from "@/models/fiscal/counterparty-resolution"
import type { TransactionFiscalDocument } from "@/models/fiscal/transaction-fiscal"
import type {
  FiscalPanelCounterpartyOption,
  FiscalPanelPeriodOption,
} from "@/models/workflow/transaction-read-api"

export type FiscalPanelProps = {
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

export function getBasisLabel(basis?: string | null) {
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

export function getDocumentKindLabel(documentKind?: string | null) {
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

export function StatusFeedback({
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

export function LockedBanner({ message }: { message: string | null }) {
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

export function AssignmentSummary({
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

export function getCounterpartyResolutionDescription(
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

export function getCandidateMatchLabel(matchReasons: string[]) {
  if (matchReasons.includes("tax_id_exact")) {
    return "Coincidencia exacta por NIF"
  }

  if (matchReasons.includes("name_exact")) {
    return "Coincidencia exacta por nombre"
  }

  return "Coincidencia sugerida"
}
