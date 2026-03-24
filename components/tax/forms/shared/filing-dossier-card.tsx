"use client"

import { saveFiscalFilingDossierAction } from "@/app/(app)/tax/forms/[obligationCode]/evidence/actions"
import { FormError } from "@/components/forms/error"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import Link from "next/link"
import { useActionState } from "react"

type FilingStatus = "draft_ready" | "ready_to_file" | "filed"

type FilingDossierCardProps = {
  obligationCode: "303" | "115" | "180" | "390"
  periodKey: string
  obligationStatus: string
  requiredEvidence: string[]
  draftSnapshot: unknown
  dossier: {
    filingReference: string | null
    filedAt: string | null
    filingReceiptFileId: string | null
    filingNotes: string | null
    checklistState: unknown
  } | null
}

const STATUS_OPTIONS: Array<{ value: FilingStatus; label: string; description: string }> = [
  {
    value: "draft_ready",
    label: "Borrador listo",
    description: "La obligación ya tiene borrador defensable, pero todavía no está lista para presentar.",
  },
  {
    value: "ready_to_file",
    label: "Lista para presentar",
    description: "El checklist está cerrado y solo falta ejecutar la presentación.",
  },
  {
    value: "filed",
    label: "Presentada",
    description: "La presentación ya está hecha y se archiva con su referencia y justificante.",
  },
]

function getCurrentStatus(status: string, dossier: FilingDossierCardProps["dossier"]): FilingStatus {
  if (status === "filed") {
    return "filed"
  }

  if (status === "ready_to_file") {
    return "ready_to_file"
  }

  if (
    dossier
    && typeof dossier.checklistState === "object"
    && dossier.checklistState !== null
    && "readyToFile" in dossier.checklistState
    && dossier.checklistState.readyToFile
  ) {
    return "ready_to_file"
  }

  return "draft_ready"
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Pendiente"
  }

  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function humanizeEvidence(code: string) {
  if (code === "source_documents") return "Documentación fuente"
  if (code === "vat_breakdown") return "Desglose de IVA"
  if (code === "draft_export") return "Borrador exportable"
  if (code === "filing_receipt") return "Justificante de presentación"
  if (code === "counterparty_tax_id") return "NIF de contraparte"
  if (code === "rent_contract") return "Contrato de alquiler"
  if (code === "external_payroll_summary") return "Resumen externo de nómina"
  return code
}

function getStatusBadgeVariant(status: FilingStatus) {
  if (status === "filed") {
    return "default"
  }

  if (status === "ready_to_file") {
    return "secondary"
  }

  return "outline"
}

export function FilingDossierCard({
  obligationCode,
  periodKey,
  obligationStatus,
  requiredEvidence,
  draftSnapshot,
  dossier,
}: FilingDossierCardProps) {
  const [saveState, saveAction, pending] = useActionState(saveFiscalFilingDossierAction, null)
  const currentStatus = saveState?.data?.status ?? getCurrentStatus(obligationStatus, dossier)
  const currentReference = saveState?.data?.filingReference ?? dossier?.filingReference ?? ""
  const currentReceiptFileId =
    saveState?.data?.filingReceiptFileId ?? dossier?.filingReceiptFileId ?? null

  return (
    <Card className="shadow-sm">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">Expediente de presentación</Badge>
          <Badge variant={getStatusBadgeVariant(currentStatus)}>
            {STATUS_OPTIONS.find((option) => option.value === currentStatus)?.label ?? currentStatus}
          </Badge>
        </div>
        <div className="space-y-2">
          <CardTitle>Estado y evidencia de la obligación</CardTitle>
          <CardDescription>
            Cierra el borrador, deja la evidencia trazada y archiva el justificante sin salir de la
            obligación.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 md:grid-cols-3">
          <SummaryItem label="Periodo" value={periodKey} />
          <SummaryItem label="Referencia actual" value={currentReference || "Pendiente"} />
          <SummaryItem label="Presentada el" value={formatDateTime(dossier?.filedAt ?? null)} />
        </div>

        <div className="flex flex-wrap gap-2">
          {requiredEvidence.map((evidenceCode) => (
            <Badge key={evidenceCode} variant="outline">
              {humanizeEvidence(evidenceCode)}
            </Badge>
          ))}
        </div>

        {currentReceiptFileId ? (
          <div className="rounded-xl border bg-muted/10 p-4 text-sm">
            <p className="font-medium">Justificante archivado</p>
            <p className="mt-1 text-muted-foreground">
              Ya hay un justificante asociado a esta obligación. Puedes descargarlo o subir uno nuevo
              para reemplazarlo.
            </p>
            <Button asChild variant="link" className="mt-2 h-auto px-0">
              <Link href={`/files/download/${currentReceiptFileId}`}>Descargar justificante actual</Link>
            </Button>
          </div>
        ) : null}

        <form action={saveAction} className="grid gap-4 rounded-xl border bg-muted/10 p-4">
          <input type="hidden" name="obligationCode" value={obligationCode} />
          <input type="hidden" name="periodKey" value={periodKey} />
          <input type="hidden" name="draftSnapshot" value={JSON.stringify(draftSnapshot ?? {})} />

          <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
            <div className="space-y-2">
              <Label htmlFor={`${obligationCode}-${periodKey}-status`}>Estado operativo</Label>
              <select
                id={`${obligationCode}-${periodKey}-status`}
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
              <Label htmlFor={`${obligationCode}-${periodKey}-filing-reference`}>
                Referencia externa / CSV
              </Label>
              <Input
                id={`${obligationCode}-${periodKey}-filing-reference`}
                name="filingReference"
                defaultValue={currentReference}
                placeholder="CSV-2026-0001"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
            <div className="space-y-2">
              <Label htmlFor={`${obligationCode}-${periodKey}-filing-notes`}>Notas de presentación</Label>
              <Textarea
                id={`${obligationCode}-${periodKey}-filing-notes`}
                name="filingNotes"
                defaultValue={dossier?.filingNotes ?? ""}
                placeholder="Quién la presentó, desde dónde y cualquier incidencia relevante."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${obligationCode}-${periodKey}-receipt`}>Justificante</Label>
              <Input id={`${obligationCode}-${periodKey}-receipt`} name="receipt" type="file" />
              <p className="text-xs text-muted-foreground">
                Sube PDF o imagen del acuse, CSV o justificante externo.
              </p>
            </div>
          </div>

          <div className="grid gap-2 rounded-xl border border-dashed p-3 text-sm text-muted-foreground md:grid-cols-3">
            {STATUS_OPTIONS.map((option) => (
              <SummaryItem key={option.value} label={option.label} value={option.description} />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando expediente..." : "Guardar expediente"}
            </Button>
            {saveState?.success ? (
              <p className="text-sm font-medium text-green-700">Expediente guardado.</p>
            ) : null}
            {saveState?.error ? <FormError>{saveState.error}</FormError> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}
