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
import type { FiscalFilingDossier } from "@/models/fiscal/filing-dossiers"
import type { FiscalObligationDetail } from "@/models/fiscal/obligations"
import type { Model115Draft } from "@/models/tax-forms/model-115"
import Link from "next/link"

type Model115DraftViewProps = {
  t: Translator
  companyName: string
  companyTaxId: string
  quarterLabel: string
  periodSelectionSource: "requested" | "active"
  availablePeriodKeys: string[]
  draft: Model115Draft
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

export function Model115DraftView({
  t,
  companyName,
  companyTaxId,
  quarterLabel,
  periodSelectionSource,
  availablePeriodKeys,
  draft,
  obligation,
  filingDossier,
}: Model115DraftViewProps) {
  const requiredEvidence = Array.isArray(obligation?.requiredEvidence)
    ? obligation.requiredEvidence.filter((item): item is string => typeof item === "string")
    : []
  const draftSnapshot = {
    obligationCode: "115",
    periodKey: quarterLabel,
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
            <Badge variant="secondary">{t("tax.forms.115.eyebrow")}</Badge>
            <Badge variant="outline">Tenant real</Badge>
            <Badge variant="outline">
              {periodSelectionSource === "requested" ? "Periodo solicitado" : "Periodo activo"}
            </Badge>
          </div>
          <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
            <p>{t("tax.forms.115.period", { period: quarterLabel })}</p>
            <p>
              Empresa: <span className="font-medium text-foreground">{companyName}</span>
            </p>
            <p>
              NIF: <span className="font-medium text-foreground">{companyTaxId}</span>
            </p>
            {availablePeriodKeys.length > 0 ? (
              <p className="sm:col-span-3">
                Periodos disponibles:{" "}
                <span className="font-medium text-foreground">{availablePeriodKeys.join(", ")}</span>
              </p>
            ) : null}
          </div>
        </CardHeader>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          label={t("tax.forms.115.metrics.perceptors")}
          value={String(draft.perceptor_count)}
        />
        <MetricCard
          label={t("tax.forms.115.metrics.documents")}
          value={String(draft.documents_included.length)}
        />
        <MetricCard
          label={t("tax.forms.115.metrics.counterparties")}
          value={String(draft.landlord_counterparty_ids.length)}
        />
        <MetricCard
          label={t("tax.forms.115.metrics.base")}
          value={formatMoney(draft.rent_base_cents)}
        />
        <MetricCard
          label={t("tax.forms.115.metrics.withholding")}
          value={formatMoney(draft.withholding_cents)}
        />
        <MetricCard
          label="Docs bloqueados"
          value={String(draft.readiness.blocked_document_count)}
        />
      </section>

      {obligation ? (
        <FilingDossierCard
          obligationCode="115"
          periodKey={quarterLabel}
          obligationStatus={obligation.status}
          requiredEvidence={requiredEvidence}
          dossier={filingDossier ?? null}
          draftSnapshot={draftSnapshot}
        />
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>{t("tax.forms.115.landlords.title")}</CardTitle>
            <CardDescription>{t("tax.forms.115.landlords.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {draft.perceptors.length === 0 ? (
              <EmptyState t={t} titleKey="tax.forms.115.landlords.empty.title" descriptionKey="tax.forms.115.landlords.empty.description" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("tax.forms.115.fields.counterparty")}</TableHead>
                    <TableHead>{t("tax.forms.115.fields.taxId")}</TableHead>
                    <TableHead className="text-right">{t("tax.forms.115.fields.documents")}</TableHead>
                    <TableHead className="text-right">{t("tax.forms.115.fields.base")}</TableHead>
                    <TableHead className="text-right">{t("tax.forms.115.fields.withholding")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {draft.perceptors.map((landlord) => (
                    <TableRow key={landlord.counterparty_id ?? landlord.counterparty_tax_id ?? landlord.counterparty_name ?? landlord.document_ids.join("-")}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">
                            {landlord.counterparty_name ?? t("tax.forms.115.counterparty.unknown")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {landlord.counterparty_id ?? t("tax.forms.115.counterparty.unlinked")}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{landlord.counterparty_tax_id ?? t("tax.forms.115.counterparty.taxIdMissing")}</TableCell>
                      <TableCell className="text-right">{landlord.document_ids.length}</TableCell>
                      <TableCell className="text-right">{formatMoney(landlord.rent_base_cents)}</TableCell>
                      <TableCell className="text-right">{formatMoney(landlord.withholding_cents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Readiness documental</CardTitle>
            <CardDescription>
              Estado operativo de la documentación que alimenta el Modelo 115 del trimestre.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ReadinessRow label="Documentos candidatos" value={String(draft.readiness.candidate_document_count)} />
            <ReadinessRow label="Documentos incluidos" value={String(draft.readiness.included_document_count)} />
            <ReadinessRow label="Documentos listos" value={String(draft.readiness.ready_document_count)} />
            <ReadinessRow label="Documentos bloqueados" value={String(draft.readiness.blocked_document_count)} />
            <ReadinessRow label="Pendientes de revisión" value={String(draft.readiness.needs_review_document_count)} />
            <ReadinessRow label="Pendientes" value={String(draft.readiness.pending_document_count)} />
            <ReadinessRow label="Líneas fuente incluidas" value={String(draft.readiness.source_line_count)} />
          </CardContent>
        </Card>
      </section>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{t("tax.forms.115.trace.title")}</CardTitle>
          <CardDescription>{t("tax.forms.115.trace.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {draft.source_lines.length === 0 ? (
            <EmptyState t={t} titleKey="tax.forms.115.trace.empty.title" descriptionKey="tax.forms.115.trace.empty.description" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("tax.forms.115.fields.issueDate")}</TableHead>
                  <TableHead>{t("tax.forms.115.fields.invoice")}</TableHead>
                  <TableHead>{t("tax.forms.115.fields.counterparty")}</TableHead>
                  <TableHead>{t("tax.forms.115.fields.concept")}</TableHead>
                  <TableHead className="text-right">{t("tax.forms.115.fields.rate")}</TableHead>
                  <TableHead className="text-right">{t("tax.forms.115.fields.base")}</TableHead>
                  <TableHead className="text-right">{t("tax.forms.115.fields.withholding")}</TableHead>
                  <TableHead>{t("tax.forms.115.fields.trace")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draft.source_lines.map((line) => (
                  <TableRow key={line.line_id}>
                    <TableCell>{formatDate(line.issue_date)}</TableCell>
                    <TableCell>{line.invoice_number ?? t("tax.forms.115.invoice.missing")}</TableCell>
                    <TableCell>{line.counterparty_name ?? t("tax.forms.115.counterparty.unknown")}</TableCell>
                    <TableCell>{line.concept}</TableCell>
                    <TableCell className="text-right">{formatPercentFromBps(line.withholding_rate_bps)}</TableCell>
                    <TableCell className="text-right">{formatMoney(line.rent_base_cents)}</TableCell>
                    <TableCell className="text-right">{formatMoney(line.withholding_cents)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Link
                          className="font-medium text-primary underline-offset-4 hover:underline"
                          href={line.source_transaction_href}
                        >
                          {t("tax.forms.115.trace.openTransaction")}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {t("tax.forms.115.trace.reference", {
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

function ReadinessRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border p-3">
      <p className="font-medium">{label}</p>
      <p className="text-muted-foreground">{value}</p>
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
