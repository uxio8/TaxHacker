import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Translator } from "@/lib/i18n"
import type { FiscalObligationDetail } from "@/models/fiscal/obligations"
import type { Model111ManualDraft } from "@/models/tax-forms/model-111-manual"
import Link from "next/link"

type Model111ManualViewProps = {
  t: Translator
  companyName: string
  companyTaxId: string
  quarterLabel: string
  periodSelectionSource: "requested" | "active"
  availablePeriodKeys: string[]
  manual: Model111ManualDraft
  obligation?: FiscalObligationDetail | null
}

function formatDueDate(value: Date | string | null | undefined) {
  if (!value) {
    return "Pendiente de calendario fiscal"
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Pendiente de calendario fiscal"
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)
}

function mapEvidenceLabel(code: string) {
  if (code === "external_payroll_summary") {
    return "Resumen externo de nómina o asesoría"
  }

  if (code === "filing_receipt") {
    return "Justificante de presentación"
  }

  return code
}

function getObligationStatusLabel(status: string | null | undefined) {
  if (status === "not_applicable") return "No aplica"
  if (status === "waiting_on_documents") return "Esperando documentación"
  if (status === "needs_review") return "Pendiente de revisión"
  if (status === "ready_to_prepare") return "Listo para revisar"
  if (status === "draft_ready") return "Resumen listo"
  if (status === "ready_to_file") return "Listo para presentar"
  if (status === "filed") return "Presentado"
  if (status === "archived") return "Archivado"
  return "Pendiente"
}

function getObligationOwnerLabel(owner: string | null | undefined) {
  if (owner === "client") return "Cliente"
  if (owner === "shared") return "Cliente / Asesoría"
  if (owner === "system") return "Sistema"
  return "Asesoría"
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}

export function Model111ManualView({
  t,
  companyName,
  companyTaxId,
  quarterLabel,
  periodSelectionSource,
  availablePeriodKeys,
  manual,
  obligation,
}: Model111ManualViewProps) {
  const requiredEvidence = Array.isArray(obligation?.requiredEvidence)
    ? obligation.requiredEvidence.filter((item): item is string => typeof item === "string")
    : manual.evidence.requiredEvidenceCodes

  return (
    <section className="flex flex-col gap-6">
      <Card className="shadow-sm">
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">Modelo 111</Badge>
            <Badge variant="outline">Manual</Badge>
            <Badge variant="outline">{manual.automation.label}</Badge>
          </div>
          <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
            <p>Periodo {quarterLabel}</p>
            <p>
              Empresa: <span className="font-medium text-foreground">{companyName}</span>
            </p>
            <p>
              NIF: <span className="font-medium text-foreground">{companyTaxId}</span>
            </p>
            <p>{periodSelectionSource === "requested" ? "Periodo solicitado" : "Periodo activo"}</p>
            <p>Estado operativo: {getObligationStatusLabel(obligation?.status)}</p>
            <p>Vencimiento: {formatDueDate(obligation?.dueDate)}</p>
            {availablePeriodKeys.length > 0 ? (
              <p className="sm:col-span-3">
                Periodos disponibles:{" "}
                <span className="font-medium text-foreground">{availablePeriodKeys.join(", ")}</span>
              </p>
            ) : null}
          </div>
        </CardHeader>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Resumen manual no automatizado</CardTitle>
            <CardDescription>{manual.automation.detail}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <SummaryItem label="Modo" value="Resumen trimestral manual" />
              <SummaryItem label="Readiness" value={manual.readinessLabel} />
              <SummaryItem label="Responsable" value={getObligationOwnerLabel(obligation?.owner)} />
            </div>
            <div className="rounded-xl border bg-muted/10 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Qué espera TaxHacker en esta fase</p>
              <p className="mt-2">
                Recoge el dato desde una fuente externa fiable, revísalo fuera del core transaccional
                y usa este espacio para controlar el trimestre sin vender un cálculo automático.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Evidencia externa obligatoria</CardTitle>
            <CardDescription>{manual.evidence.detail}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {requiredEvidence.map((item) => (
                <Badge key={item} variant="outline">
                  {mapEvidenceLabel(item)}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Sin resumen externo y sin justificante final no debe presentarse el 111 como cerrado.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Checklist operativo</CardTitle>
            <CardDescription>
              Pasos mínimos para trabajar el trimestre sin apariencia de cálculo automático.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {manual.checklist.map((item) => (
              <div key={item} className="rounded-lg border bg-muted/20 px-3 py-2">
                {item}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Límites del alcance</CardTitle>
            <CardDescription>
              Guardrails del Modelo 111 V1 para no inducir a error fiscal o de producto.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {manual.warnings.map((item) => (
              <div key={item} className="rounded-lg border bg-muted/20 px-3 py-2">
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Siguiente paso recomendado</CardTitle>
          <CardDescription>
            Sigue el flujo manual y documental antes de marcar esta obligación como revisada.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button asChild className="w-full sm:w-auto">
            <Link href="/tax/quarters">Revisar trimestre fiscal</Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/tax/forms">{t("tax.forms.index.open")}</Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  )
}
