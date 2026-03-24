"use client"

import { saveTransactionFiscalPanelAction } from "@/app/(app)/transactions/fiscal-actions"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useActionState } from "react"

import { CounterpartySection } from "./fiscal-panel/counterparty-section"
import { PaymentDateSection } from "./fiscal-panel/payment-date-section"
import { PeriodOverrideSection } from "./fiscal-panel/period-override-section"
import {
  AssignmentSummary,
  type FiscalPanelProps,
  getBasisLabel,
  getDocumentKindLabel,
} from "./fiscal-panel/shared"

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
        <CounterpartySection
          transactionId={transactionId}
          document={currentDocument}
          counterpartyOptions={counterpartyOptions}
          counterpartyResolution={counterpartyResolution}
          action={counterpartyAction}
          pending={counterpartyPending}
          state={counterpartyState}
        />

        <PaymentDateSection
          transactionId={transactionId}
          document={currentDocument}
          lockMessage={paymentDateLockMessage}
          action={paymentAction}
          pending={paymentPending}
          state={paymentState}
        />

        <section className="grid gap-4 xl:grid-cols-2">
          <PeriodOverrideSection
            transactionId={transactionId}
            title="Override de IVA"
            summary={`Basis actual: ${getBasisLabel(currentDocument.header.vat_period_assignment?.basis)}`}
            periodOptions={periodOptions}
            selectedPeriodKey={currentDocument.header.vat_period_assignment?.period_key}
            lockMessage={vatLockMessage}
            action={vatAction}
            pending={vatPending}
            submitIntent="override_vat_manual"
            resetIntent="reset_vat_automatic"
            submitLabel="Guardar override IVA"
            state={vatState}
          />
          <PeriodOverrideSection
            transactionId={transactionId}
            title="Override de retenciones"
            summary={`Basis actual: ${getBasisLabel(currentDocument.header.withholding_period_assignment?.basis)}`}
            periodOptions={periodOptions}
            selectedPeriodKey={currentDocument.header.withholding_period_assignment?.period_key}
            lockMessage={withholdingLockMessage}
            action={withholdingAction}
            pending={withholdingPending}
            submitIntent="override_withholding_manual"
            resetIntent="reset_withholding_automatic"
            submitLabel="Guardar override retenciones"
            state={withholdingState}
          />
        </section>
      </CardContent>
    </Card>
  )
}
