import { FilingDossierCard } from "@/components/tax/forms/shared/filing-dossier-card"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { FiscalFilingDossier } from "@/models/fiscal/filing-dossiers"
import type { FiscalObligationDetail } from "@/models/fiscal/obligations"
import { MODEL_303_SUPPORTED_VAT_RATE_BPS } from "@/models/tax-forms/model-303"
import type { Model390Draft, Model390TraceRow } from "@/models/tax-forms/model-390"
import Link from "next/link"

type Model390DraftViewProps = {
  companyName: string
  companyTaxId: string
  periodLabel: string
  periodSelectionSource: "requested" | "active"
  availablePeriodKeys: string[]
  draft: Model390Draft
  readiness: {
    candidate_document_count: number
    included_document_count: number
    ready_document_count: number
    blocked_document_count: number
    needs_review_document_count: number
    pending_document_count: number
  }
  obligation?: FiscalObligationDetail | null
  filingDossier?: FiscalFilingDossier | null
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

function formatPercentFromBps(bps: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(bps / 10000)
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`))
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="gap-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tracking-tight">{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}

function getTraceSectionLabel(row: Model390TraceRow) {
  if (row.section === "output") {
    return "IVA repercutido"
  }

  if (row.section === "input_deductible") {
    return "IVA soportado deducible"
  }

  return "IVA soportado no deducible"
}

export function Model390DraftView({
  companyName,
  companyTaxId,
  periodLabel,
  periodSelectionSource,
  availablePeriodKeys,
  draft,
  readiness,
  obligation,
  filingDossier,
}: Model390DraftViewProps) {
  const requiredEvidence = Array.isArray(obligation?.requiredEvidence)
    ? obligation.requiredEvidence.filter((item): item is string => typeof item === "string")
    : []
  const draftSnapshot = {
    obligationCode: "390",
    periodKey: periodLabel,
    totals: {
      documentsIncluded: draft.documents_included.length,
      outputVatTotalCents: draft.output_vat_total_cents,
      inputVatDeductibleTotalCents: draft.input_vat_deductible_total_cents,
      inputVatNonDeductibleTotalCents: draft.input_vat_non_deductible_total_cents,
      resultVatPayableCents: draft.result_vat_payable_cents,
    },
    readiness,
  }

  return (
    <section className="flex flex-col gap-6">
      <Card className="shadow-sm">
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">Modelo 390</Badge>
            <Badge variant="outline">Derivado del 303</Badge>
            <Badge variant="outline">
              {periodSelectionSource === "requested" ? "Periodo solicitado" : "Año activo"}
            </Badge>
          </div>
          <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
            <p>Ejercicio {periodLabel}</p>
            <p>
              Empresa: <span className="font-medium text-foreground">{companyName}</span>
            </p>
            <p>
              NIF: <span className="font-medium text-foreground">{companyTaxId}</span>
            </p>
            {availablePeriodKeys.length > 0 ? (
              <p className="sm:col-span-3">
                Ejercicios disponibles:{" "}
                <span className="font-medium text-foreground">{availablePeriodKeys.join(", ")}</span>
              </p>
            ) : null}
          </div>
        </CardHeader>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Documentos incluidos" value={String(draft.documents_included.length)} />
        <MetricCard label="IVA repercutido" value={formatMoney(draft.output_vat_total_cents)} />
        <MetricCard label="IVA deducible" value={formatMoney(draft.input_vat_deductible_total_cents)} />
        <MetricCard label="IVA no deducible" value={formatMoney(draft.input_vat_non_deductible_total_cents)} />
        <MetricCard label="Resultado neto" value={formatMoney(draft.result_vat_payable_cents)} />
        <MetricCard label="Docs bloqueados" value={String(readiness.blocked_document_count)} />
      </section>

      {obligation ? (
        <FilingDossierCard
          obligationCode="390"
          periodKey={periodLabel}
          obligationStatus={obligation.status}
          requiredEvidence={requiredEvidence}
          dossier={filingDossier ?? null}
          draftSnapshot={draftSnapshot}
        />
      ) : null}

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Desglose anual por tipo impositivo</CardTitle>
          <CardDescription>
            Consolidado anual del 390 reutilizando exactamente el núcleo validado del 303.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Base repercutida</TableHead>
                <TableHead className="text-right">IVA repercutido</TableHead>
                <TableHead className="text-right">Base deducible</TableHead>
                <TableHead className="text-right">IVA deducible</TableHead>
                <TableHead className="text-right">Base no deducible</TableHead>
                <TableHead className="text-right">IVA no deducible</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MODEL_303_SUPPORTED_VAT_RATE_BPS.map((rate) => (
                <TableRow key={rate}>
                  <TableCell>{formatPercentFromBps(rate)}</TableCell>
                  <TableCell className="text-right">{formatMoney(draft.output_vat_by_rate[rate].base_cents)}</TableCell>
                  <TableCell className="text-right">{formatMoney(draft.output_vat_by_rate[rate].vat_cents)}</TableCell>
                  <TableCell className="text-right">{formatMoney(draft.input_vat_deductible_by_rate[rate].base_cents)}</TableCell>
                  <TableCell className="text-right">{formatMoney(draft.input_vat_deductible_by_rate[rate].vat_cents)}</TableCell>
                  <TableCell className="text-right">{formatMoney(draft.input_vat_non_deductible_by_rate[rate].base_cents)}</TableCell>
                  <TableCell className="text-right">{formatMoney(draft.input_vat_non_deductible_by_rate[rate].vat_cents)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Resumen por trimestre</CardTitle>
            <CardDescription>
              Vista anual compacta para cuadrar el 390 frente a los trimestres presentados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trimestre</TableHead>
                  <TableHead className="text-right">Documentos</TableHead>
                  <TableHead className="text-right">Repercutido</TableHead>
                  <TableHead className="text-right">Deducible</TableHead>
                  <TableHead className="text-right">Resultado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draft.quarter_summaries.map((summary) => (
                  <TableRow key={summary.period_key}>
                    <TableCell>{summary.period_key}</TableCell>
                    <TableCell className="text-right">{summary.documents_included.length}</TableCell>
                    <TableCell className="text-right">{formatMoney(summary.output_vat_total_cents)}</TableCell>
                    <TableCell className="text-right">{formatMoney(summary.input_vat_deductible_total_cents)}</TableCell>
                    <TableCell className="text-right">{formatMoney(summary.result_vat_payable_cents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Readiness documental</CardTitle>
            <CardDescription>
              Estado anual del material que alimenta el 390 antes de preparar el expediente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>Documentos candidatos: {readiness.candidate_document_count}</p>
            <p>Documentos incluidos: {readiness.included_document_count}</p>
            <p>Documentos listos: {readiness.ready_document_count}</p>
            <p>Bloqueados: {readiness.blocked_document_count}</p>
            <p>Pendientes de revisión: {readiness.needs_review_document_count}</p>
            <p>Pendientes: {readiness.pending_document_count}</p>
          </CardContent>
        </Card>
      </section>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Trazabilidad anual del IVA</CardTitle>
          <CardDescription>
            Cada fila anual apunta al documento y línea fuente utilizados por el núcleo del 303.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {draft.trace_rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin líneas trazables para este anual.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trimestre</TableHead>
                  <TableHead>Sección</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Factura</TableHead>
                  <TableHead>Contraparte</TableHead>
                  <TableHead className="text-right">Tipo</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">IVA</TableHead>
                  <TableHead>Traza</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draft.trace_rows.map((row) => (
                  <TableRow key={`${row.period_key}-${row.section}-${row.line.line_id}`}>
                    <TableCell>{row.period_key}</TableCell>
                    <TableCell>{getTraceSectionLabel(row)}</TableCell>
                    <TableCell>{formatDate(row.line.issue_date)}</TableCell>
                    <TableCell>{row.line.invoice_number ?? "Sin número"}</TableCell>
                    <TableCell>{row.line.counterparty_name ?? "Contraparte sin nombre"}</TableCell>
                    <TableCell className="text-right">{formatPercentFromBps(row.line.vat_rate_bps)}</TableCell>
                    <TableCell className="text-right">{formatMoney(row.line.base_amount_cents)}</TableCell>
                    <TableCell className="text-right">{formatMoney(row.line.vat_amount_cents)}</TableCell>
                    <TableCell>
                      <Link
                        className="font-medium text-primary underline-offset-4 hover:underline"
                        href={row.line.source_transaction_href}
                      >
                        Abrir transacción
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
