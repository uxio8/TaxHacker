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
import type { Model180Draft } from "@/models/tax-forms/model-180"
import Link from "next/link"

type Model180DraftViewProps = {
  companyName: string
  companyTaxId: string
  periodLabel: string
  periodSelectionSource: "requested" | "active"
  availablePeriodKeys: string[]
  draft: Model180Draft
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

export function Model180DraftView({
  companyName,
  companyTaxId,
  periodLabel,
  periodSelectionSource,
  availablePeriodKeys,
  draft,
  obligation,
  filingDossier,
}: Model180DraftViewProps) {
  const requiredEvidence = Array.isArray(obligation?.requiredEvidence)
    ? obligation.requiredEvidence.filter((item): item is string => typeof item === "string")
    : []
  const draftSnapshot = {
    obligationCode: "180",
    periodKey: periodLabel,
    totals: {
      perceptorCount: draft.perceptor_count,
      documentCount: draft.documents_included.length,
      rentBaseCents: draft.rent_base_cents,
      withholdingCents: draft.withholding_cents,
    },
    readiness: draft.readiness,
  }

  return (
    <section className="flex flex-col gap-6">
      <Card className="shadow-sm">
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">Modelo 180</Badge>
            <Badge variant="outline">Derivado del 115</Badge>
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
        <MetricCard label="Perceptores" value={String(draft.perceptor_count)} />
        <MetricCard label="Documentos incluidos" value={String(draft.documents_included.length)} />
        <MetricCard label="Base alquiler" value={formatMoney(draft.rent_base_cents)} />
        <MetricCard label="Retención" value={formatMoney(draft.withholding_cents)} />
        <MetricCard label="Docs bloqueados" value={String(draft.readiness.blocked_document_count)} />
        <MetricCard label="Líneas fuente" value={String(draft.readiness.source_line_count)} />
      </section>

      {obligation ? (
        <FilingDossierCard
          obligationCode="180"
          periodKey={periodLabel}
          obligationStatus={obligation.status}
          requiredEvidence={requiredEvidence}
          dossier={filingDossier ?? null}
          draftSnapshot={draftSnapshot}
        />
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Perceptores anuales</CardTitle>
            <CardDescription>
              Resumen anual por arrendador reutilizando el núcleo trimestral del 115.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {draft.perceptors.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay perceptores con retención listos para el ejercicio.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contraparte</TableHead>
                    <TableHead>NIF</TableHead>
                    <TableHead className="text-right">Documentos</TableHead>
                    <TableHead className="text-right">Base</TableHead>
                    <TableHead className="text-right">Retención</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {draft.perceptors.map((perceptor) => (
                    <TableRow
                      key={
                        perceptor.counterparty_id
                        ?? perceptor.counterparty_tax_id
                        ?? perceptor.counterparty_name
                        ?? perceptor.document_ids.join("-")
                      }
                    >
                      <TableCell>{perceptor.counterparty_name ?? "Contraparte sin nombre"}</TableCell>
                      <TableCell>{perceptor.counterparty_tax_id ?? "NIF pendiente"}</TableCell>
                      <TableCell className="text-right">{perceptor.document_ids.length}</TableCell>
                      <TableCell className="text-right">{formatMoney(perceptor.rent_base_cents)}</TableCell>
                      <TableCell className="text-right">{formatMoney(perceptor.withholding_cents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Desglose trimestral</CardTitle>
            <CardDescription>
              Control de cómo se compone el anual a partir de cada trimestre.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {draft.quarter_summaries.map((summary) => (
              <div key={summary.period_key} className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{summary.period_key}</p>
                  <Badge variant="outline">{summary.perceptor_count} perceptores</Badge>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <p>Documentos: {summary.documents_included.length}</p>
                  <p>Base: {formatMoney(summary.rent_base_cents)}</p>
                  <p>Retención: {formatMoney(summary.withholding_cents)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Trazabilidad anual</CardTitle>
          <CardDescription>
            Cada línea anual enlaza con la transacción origen para poder defender el resumen anual.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {draft.source_lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin líneas fuente listas para este anual.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trimestre</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Factura</TableHead>
                  <TableHead>Contraparte</TableHead>
                  <TableHead className="text-right">Tipo</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">Retención</TableHead>
                  <TableHead>Traza</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draft.source_lines.map((line) => (
                  <TableRow key={line.line_id}>
                    <TableCell>{`T${line.quarter}`}</TableCell>
                    <TableCell>{formatDate(line.issue_date)}</TableCell>
                    <TableCell>{line.invoice_number ?? "Sin número"}</TableCell>
                    <TableCell>{line.counterparty_name ?? "Contraparte sin nombre"}</TableCell>
                    <TableCell className="text-right">{formatPercentFromBps(line.withholding_rate_bps)}</TableCell>
                    <TableCell className="text-right">{formatMoney(line.rent_base_cents)}</TableCell>
                    <TableCell className="text-right">{formatMoney(line.withholding_cents)}</TableCell>
                    <TableCell>
                      <Link
                        className="font-medium text-primary underline-offset-4 hover:underline"
                        href={line.source_transaction_href}
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
