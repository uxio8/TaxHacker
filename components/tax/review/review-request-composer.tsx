"use client"

import { createFiscalReviewRequestAction } from "@/app/(app)/tax/review/actions"
import { FormError } from "@/components/forms/error"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useActionState } from "react"

export function ReviewRequestComposer({
  fiscalDocumentId,
}: {
  fiscalDocumentId: string
}) {
  const [state, action, pending] = useActionState(createFiscalReviewRequestAction, null)

  return (
    <form action={action} className="space-y-3 rounded-lg border bg-muted/10 p-4">
      <input type="hidden" name="fiscalDocumentId" value={fiscalDocumentId} />

      <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
        <div className="space-y-2">
          <Label htmlFor={`owner-${fiscalDocumentId}`}>Responsable</Label>
          <select
            id={`owner-${fiscalDocumentId}`}
            name="owner"
            defaultValue="client"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="client">Cliente</option>
            <option value="advisor">Asesoría</option>
            <option value="shared">Compartido</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`dueDate-${fiscalDocumentId}`}>Fecha límite</Label>
          <Input id={`dueDate-${fiscalDocumentId}`} name="dueDate" type="date" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`message-${fiscalDocumentId}`}>Qué falta exactamente</Label>
        <Textarea
          id={`message-${fiscalDocumentId}`}
          name="message"
          rows={3}
          placeholder="Ejemplo: falta el contrato de alquiler firmado y el NIF correcto de la contraparte."
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Abriendo incidencia..." : "Abrir incidencia"}
        </Button>
        {state?.success ? <p className="text-sm font-medium text-green-700">Incidencia creada.</p> : null}
        {state?.error ? <FormError>{state.error}</FormError> : null}
      </div>
    </form>
  )
}
