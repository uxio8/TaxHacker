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
import type { Translator } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type {
  Model303AmountsByRate,
  Model303Draft,
  Model303SupportedVatRateBps,
  Model303Trace,
  Model303TraceLine,
} from "@/models/tax-forms/model-303"
import { MODEL_303_SUPPORTED_VAT_RATE_BPS } from "@/models/tax-forms/model-303"
import type { Model303Readiness } from "@/models/tax-forms/model-303-loader"
import type { FiscalFilingDossier } from "@/models/fiscal/filing-dossiers"
import type { FiscalObligationDetail } from "@/models/fiscal/obligations"
import Link from "next/link"

type OracleSummary = {
  documents_included: string[]
  output_vat_by_rate: Model303AmountsByRate
  input_vat_deductible_by_rate: Model303AmountsByRate
  input_vat_non_deductible_by_rate: Model303AmountsByRate
  output_vat_total_cents: number
  input_vat_deductible_total_cents: number
  result_vat_payable_cents: number
}

type Model303DraftViewProps = {
  t: Translator
  quarterLabel: string
  draft: Model303Draft
  oracle?: OracleSummary
  datasetId?: string
  datasetVersion?: number
  readiness?: Model303Readiness
  obligation?: FiscalObligationDetail | null
  filingDossier?: FiscalFilingDossier | null
}

type BreakdownSection = {
  key: keyof Pick<
    Model303Draft,
    "output_vat_by_rate" | "input_vat_deductible_by_rate" | "input_vat_non_deductible_by_rate"
  >
  titleKey: Parameters<Translator>[0]
  descriptionKey: Parameters<Translator>[0]
  traceLabelKey: Parameters<Translator>[0]
}

type TraceRow = {
  sectionLabel: string
  line: Model303TraceLine
}

const BREAKDOWN_SECTIONS: BreakdownSection[] = [
  {
    key: "output_vat_by_rate",
    titleKey: "tax.forms.303.breakdown.output.title",
    descriptionKey: "tax.forms.303.breakdown.output.description",
    traceLabelKey: "tax.forms.303.trace.section.output",
  },
  {
    key: "input_vat_deductible_by_rate",
    titleKey: "tax.forms.303.breakdown.inputDeductible.title",
    descriptionKey: "tax.forms.303.breakdown.inputDeductible.description",
    traceLabelKey: "tax.forms.303.trace.section.inputDeductible",
  },
  {
    key: "input_vat_non_deductible_by_rate",
    titleKey: "tax.forms.303.breakdown.inputNonDeductible.title",
    descriptionKey: "tax.forms.303.breakdown.inputNonDeductible.description",
    traceLabelKey: "tax.forms.303.trace.section.inputNonDeductible",
  },
]

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

function sumVatByRate(amountsByRate: Model303AmountsByRate) {
  return MODEL_303_SUPPORTED_VAT_RATE_BPS.reduce(
    (total, rate) => total + amountsByRate[rate].vat_cents,
    0
  )
}

function buildOracleStatus(draft: Model303Draft, oracle: OracleSummary) {
  const matches =
    JSON.stringify({
      documents_included: draft.documents_included,
      output_vat_by_rate: draft.output_vat_by_rate,
      input_vat_deductible_by_rate: draft.input_vat_deductible_by_rate,
      input_vat_non_deductible_by_rate: draft.input_vat_non_deductible_by_rate,
      output_vat_total_cents: draft.output_vat_total_cents,
      input_vat_deductible_total_cents: draft.input_vat_deductible_total_cents,
      result_vat_payable_cents: draft.result_vat_payable_cents,
    }) === JSON.stringify(oracle)

  return {
    matches,
    variant: matches ? "default" : "destructive",
  } as const
}

function buildTraceRows(t: Translator, trace: Model303Trace): TraceRow[] {
  const rows: TraceRow[] = []

  for (const section of BREAKDOWN_SECTIONS) {
    for (const rate of MODEL_303_SUPPORTED_VAT_RATE_BPS) {
      for (const line of trace[section.key][rate]) {
        rows.push({
          sectionLabel: t(section.traceLabelKey),
          line,
        })
      }
    }
  }

  return rows
}

function getReadinessBadgeVariant(status: Model303Readiness["status"] | undefined) {
  if (status === "ready") {
    return "default"
  }

  if (status === "attention_required" || status === "missing_period") {
    return "secondary"
  }

  return "outline"
}

function buildDraftSnapshot(periodKey: string, draft: Model303Draft, readiness?: Model303Readiness) {
  return {
    obligationCode: "303",
    periodKey,
    totals: {
      documentsIncluded: draft.documents_included.length,
      outputVatTotalCents: draft.output_vat_total_cents,
      inputVatDeductibleTotalCents: draft.input_vat_deductible_total_cents,
      inputVatNonDeductibleTotalCents: draft.input_vat_non_deductible_total_cents,
      resultVatPayableCents: draft.result_vat_payable_cents,
    },
    readiness,
  }
}

export function Model303DraftView({
  t,
  oracle,
  quarterLabel,
  draft,
  datasetId,
  datasetVersion,
  readiness,
  obligation,
  filingDossier,
}: Model303DraftViewProps) {
  const oracleStatus = oracle ? buildOracleStatus(draft, oracle) : null
  const traceRows = buildTraceRows(t, draft.trace)
  const requiredEvidence = Array.isArray(obligation?.requiredEvidence)
    ? obligation.requiredEvidence.filter((item): item is string => typeof item === "string")
    : []
  const oracleInputVatNonDeductibleTotalCents = oracle
    ? sumVatByRate(oracle.input_vat_non_deductible_by_rate)
    : 0

  return (
    <section className="flex flex-col gap-6">
      <Card className="shadow-sm">
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">{t("tax.forms.303.eyebrow")}</Badge>
            {readiness ? (
              <Badge variant={getReadinessBadgeVariant(readiness.status)}>{readiness.label}</Badge>
            ) : null}
            {oracleStatus ? (
              <Badge variant={oracleStatus.variant}>
                {t(`tax.forms.303.oracle.${oracleStatus.matches ? "match" : "mismatch"}`)}
              </Badge>
            ) : null}
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl tracking-tight">{t("tax.forms.303.title")}</CardTitle>
            <CardDescription className="max-w-3xl text-sm sm:text-base">
              {t("tax.forms.303.description")}
            </CardDescription>
          </div>
          <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
            <p>{t("tax.forms.303.period", { period: quarterLabel })}</p>
            {datasetId ? <p>{t("tax.forms.303.dataset", { datasetId })}</p> : <p>Fuente: tenant actual</p>}
            {typeof datasetVersion === "number" ? (
              <p>{t("tax.forms.303.datasetVersion", { version: datasetVersion })}</p>
            ) : readiness ? (
              <p>{readiness.detail}</p>
            ) : null}
          </div>
        </CardHeader>
      </Card>

      {readiness ? (
        <Card className="shadow-sm">
          <CardHeader className="gap-2">
            <CardTitle>Estado del borrador</CardTitle>
            <CardDescription>{readiness.detail}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-5">
            <StatusSummaryItem label="Documentos del trimestre" value={String(readiness.summary.totalDocuments)} />
            <StatusSummaryItem label="Con impacto 303" value={String(readiness.summary.model303CandidateCount)} />
            <StatusSummaryItem label="En revisión" value={String(readiness.summary.reviewDocumentCount)} />
            <StatusSummaryItem label="Bloqueados" value={String(readiness.summary.blockingDocumentCount)} />
            <StatusSummaryItem label="Omitidos" value={String(readiness.summary.skippedDocumentCount)} />
          </CardContent>
        </Card>
      ) : null}

      {obligation ? (
        <FilingDossierCard
          obligationCode="303"
          periodKey={quarterLabel}
          obligationStatus={obligation.status}
          requiredEvidence={requiredEvidence}
          dossier={filingDossier ?? null}
          draftSnapshot={buildDraftSnapshot(quarterLabel, draft, readiness)}
        />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label={t("tax.forms.303.metrics.documents")}
          value={String(draft.documents_included.length)}
        />
        <MetricCard
          label={t("tax.forms.303.metrics.outputVat")}
          value={formatMoney(draft.output_vat_total_cents)}
        />
        <MetricCard
          label={t("tax.forms.303.metrics.inputDeductibleVat")}
          value={formatMoney(draft.input_vat_deductible_total_cents)}
        />
        <MetricCard
          label={t("tax.forms.303.metrics.inputNonDeductibleVat")}
          value={formatMoney(draft.input_vat_non_deductible_total_cents)}
        />
        <MetricCard
          label={t("tax.forms.303.metrics.result")}
          value={formatMoney(draft.result_vat_payable_cents)}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="grid gap-6">
          {BREAKDOWN_SECTIONS.map((section) => (
            <BreakdownCard
              key={section.key}
              t={t}
              title={t(section.titleKey)}
              description={t(section.descriptionKey)}
              amountsByRate={draft[section.key]}
              oracleByRate={oracle?.[section.key]}
            />
          ))}
        </div>

        {oracle ? (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>{t("tax.forms.303.oracle.title")}</CardTitle>
              <CardDescription>{t("tax.forms.303.oracle.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <OracleRow
                label={t("tax.forms.303.metrics.documents")}
                draftValue={String(draft.documents_included.length)}
                oracleValue={String(oracle.documents_included.length)}
              />
              <OracleRow
                label={t("tax.forms.303.metrics.outputVat")}
                draftValue={formatMoney(draft.output_vat_total_cents)}
                oracleValue={formatMoney(oracle.output_vat_total_cents)}
              />
              <OracleRow
                label={t("tax.forms.303.metrics.inputDeductibleVat")}
                draftValue={formatMoney(draft.input_vat_deductible_total_cents)}
                oracleValue={formatMoney(oracle.input_vat_deductible_total_cents)}
              />
              <OracleRow
                label={t("tax.forms.303.metrics.inputNonDeductibleVat")}
                draftValue={formatMoney(draft.input_vat_non_deductible_total_cents)}
                oracleValue={formatMoney(oracleInputVatNonDeductibleTotalCents)}
              />
              <OracleRow
                label={t("tax.forms.303.metrics.result")}
                draftValue={formatMoney(draft.result_vat_payable_cents)}
                oracleValue={formatMoney(oracle.result_vat_payable_cents)}
              />
            </CardContent>
          </Card>
        ) : null}
      </section>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{t("tax.forms.303.trace.title")}</CardTitle>
          <CardDescription>{t("tax.forms.303.trace.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {traceRows.length === 0 ? (
            <EmptyState
              t={t}
              titleKey="tax.forms.303.trace.empty.title"
              descriptionKey="tax.forms.303.trace.empty.description"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("tax.forms.303.fields.section")}</TableHead>
                  <TableHead>{t("tax.forms.303.fields.issueDate")}</TableHead>
                  <TableHead>{t("tax.forms.303.fields.invoice")}</TableHead>
                  <TableHead>{t("tax.forms.303.fields.counterparty")}</TableHead>
                  <TableHead>{t("tax.forms.303.fields.concept")}</TableHead>
                  <TableHead className="text-right">{t("tax.forms.303.fields.rate")}</TableHead>
                  <TableHead className="text-right">{t("tax.forms.303.fields.base")}</TableHead>
                  <TableHead className="text-right">{t("tax.forms.303.fields.vat")}</TableHead>
                  <TableHead>{t("tax.forms.303.fields.trace")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {traceRows.map(({ sectionLabel, line }) => (
                  <TableRow key={line.line_id}>
                    <TableCell>{sectionLabel}</TableCell>
                    <TableCell>{formatDate(line.issue_date)}</TableCell>
                    <TableCell>{line.invoice_number ?? t("tax.forms.303.invoice.missing")}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">
                          {line.counterparty_name ?? t("tax.forms.303.counterparty.unknown")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {line.counterparty_tax_id ?? t("tax.forms.303.counterparty.taxIdMissing")}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{line.concept}</TableCell>
                    <TableCell className="text-right">{formatPercentFromBps(line.vat_rate_bps)}</TableCell>
                    <TableCell className="text-right">{formatMoney(line.base_amount_cents)}</TableCell>
                    <TableCell className="text-right">{formatMoney(line.vat_amount_cents)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Link
                          className="font-medium text-primary underline-offset-4 hover:underline"
                          href={line.source_transaction_href}
                        >
                          {t("tax.forms.303.trace.openTransaction")}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {t("tax.forms.303.trace.reference", {
                            fiscalDocumentId: line.fiscal_document_id,
                            lineId: line.line_id,
                          })}
                        </p>
                      </div>
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

function BreakdownCard({
  t,
  title,
  description,
  amountsByRate,
  oracleByRate,
}: {
  t: Translator
  title: string
  description: string
  amountsByRate: Model303AmountsByRate
  oracleByRate?: Model303AmountsByRate
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("tax.forms.303.fields.rate")}</TableHead>
              <TableHead className="text-right">{t("tax.forms.303.fields.draftBase")}</TableHead>
              <TableHead className="text-right">{t("tax.forms.303.fields.draftVat")}</TableHead>
              {oracleByRate ? (
                <>
                  <TableHead className="text-right">{t("tax.forms.303.fields.oracleBase")}</TableHead>
                  <TableHead className="text-right">{t("tax.forms.303.fields.oracleVat")}</TableHead>
                  <TableHead className="text-right">{t("tax.forms.303.fields.status")}</TableHead>
                </>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {MODEL_303_SUPPORTED_VAT_RATE_BPS.map((rate) => (
              <BreakdownRow
                key={rate}
                rate={rate}
                draftLine={amountsByRate[rate]}
                oracleLine={oracleByRate?.[rate]}
                t={t}
              />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function BreakdownRow({
  rate,
  draftLine,
  oracleLine,
  t,
}: {
  rate: Model303SupportedVatRateBps
  draftLine: Model303AmountsByRate[Model303SupportedVatRateBps]
  oracleLine?: Model303AmountsByRate[Model303SupportedVatRateBps]
  t: Translator
}) {
  const matches =
    oracleLine
      ? draftLine.base_cents === oracleLine.base_cents && draftLine.vat_cents === oracleLine.vat_cents
      : true

  return (
    <TableRow>
      <TableCell>{formatPercentFromBps(rate)}</TableCell>
      <TableCell className="text-right">{formatMoney(draftLine.base_cents)}</TableCell>
      <TableCell className="text-right">{formatMoney(draftLine.vat_cents)}</TableCell>
      {oracleLine ? (
        <>
          <TableCell className="text-right text-muted-foreground">
            {formatMoney(oracleLine.base_cents)}
          </TableCell>
          <TableCell className="text-right text-muted-foreground">
            {formatMoney(oracleLine.vat_cents)}
          </TableCell>
          <TableCell className="text-right">
            <Badge
              variant={matches ? "outline" : "destructive"}
              className={cn(matches ? undefined : "border-transparent")}
            >
              {t(`tax.forms.303.oracle.${matches ? "match" : "mismatch"}`)}
            </Badge>
          </TableCell>
        </>
      ) : null}
    </TableRow>
  )
}

function StatusSummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="gap-1">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}

function OracleRow({
  label,
  draftValue,
  oracleValue,
}: {
  label: string
  draftValue: string
  oracleValue: string
}) {
  const matches = draftValue === oracleValue

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-lg border p-3">
      <p className="font-medium">{label}</p>
      <p className="text-muted-foreground">{draftValue}</p>
      <Badge variant={matches ? "outline" : "destructive"} className={cn(!matches && "border-transparent")}>
        {oracleValue}
      </Badge>
    </div>
  )
}

function EmptyState({
  t,
  titleKey,
  descriptionKey,
}: {
  t: Translator
  titleKey: Parameters<Translator>[0]
  descriptionKey: Parameters<Translator>[0]
}) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-6">
      <p className="font-medium">{t(titleKey)}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t(descriptionKey)}</p>
    </div>
  )
}
