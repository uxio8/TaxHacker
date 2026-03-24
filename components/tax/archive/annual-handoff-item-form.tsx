"use client"

import { useActionState } from "react"

import { saveAnnualHandoffItemAction } from "@/app/(app)/tax/archive/annual/actions"
import { FormError } from "@/components/forms/error"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { AnnualHandoffItemCode } from "@/models/fiscal/annual-handoff"

type AnnualHandoffStatus =
  | "not_applicable"
  | "waiting_on_documents"
  | "needs_review"
  | "draft_ready"
  | "ready_to_file"
  | "filed"
  | "archived"

type AnnualHandoffOwner = "advisor" | "client" | "shared"

const STATUS_OPTIONS: Array<{ value: AnnualHandoffStatus; label: string }> = [
  { value: "waiting_on_documents", label: "Esperando documentación" },
  { value: "needs_review", label: "Requiere revisión" },
  { value: "draft_ready", label: "Pack listo" },
  { value: "ready_to_file", label: "Listo para presentar" },
  { value: "filed", label: "Presentado" },
  { value: "archived", label: "Archivado" },
  { value: "not_applicable", label: "No aplica" },
]

const OWNER_OPTIONS: Array<{ value: AnnualHandoffOwner; label: string }> = [
  { value: "advisor", label: "Asesoría" },
  { value: "shared", label: "Cliente / Asesoría" },
  { value: "client", label: "Cliente" },
]

export function AnnualHandoffItemForm({
  code,
  periodKey,
  defaultStatus,
  defaultOwner,
  defaultNotes,
}: {
  code: AnnualHandoffItemCode
  periodKey: string
  defaultStatus: string
  defaultOwner: string
  defaultNotes: string
}) {
  const [saveState, saveAction, pending] = useActionState(saveAnnualHandoffItemAction, null)
  const currentStatus = (
    saveState?.data?.code === code ? saveState.data.status : defaultStatus
  ) as AnnualHandoffStatus
  const currentOwner = (
    saveState?.data?.code === code ? saveState.data.owner : defaultOwner
  ) as AnnualHandoffOwner
  const currentNotes =
    saveState?.data?.code === code ? saveState.data.notes ?? "" : defaultNotes

  return (
    <form action={saveAction} className="grid gap-4 rounded-xl border bg-muted/10 p-4">
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="periodKey" value={periodKey} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`annual-handoff-status-${code}`}>Estado del handoff anual {code}</Label>
          <select
            id={`annual-handoff-status-${code}`}
            name="status"
            defaultValue={currentStatus}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`annual-handoff-owner-${code}`}>Responsable anual {code}</Label>
          <select
            id={`annual-handoff-owner-${code}`}
            name="owner"
            defaultValue={currentOwner}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {OWNER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`annual-handoff-notes-${code}`}>Notas internas {code}</Label>
        <Textarea
          id={`annual-handoff-notes-${code}`}
          name="notes"
          defaultValue={currentNotes}
          placeholder="Qué falta, quién tiene la pelota y cualquier contexto útil para el cierre anual."
          rows={3}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando seguimiento..." : "Guardar seguimiento"}
        </Button>
        {saveState?.success && saveState.data?.code === code ? (
          <p className="text-sm font-medium text-green-700">Seguimiento guardado.</p>
        ) : null}
        {saveState?.error ? <FormError>{saveState.error}</FormError> : null}
      </div>
    </form>
  )
}
