import { ReviewStatusBadge } from "@/components/tax/review/review-status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { MessageKey, Translator } from "@/lib/i18n"
import type {
  LegalArchiveExpectedSource,
  LegalArchiveFiling,
  LegalArchivePeriodDetail,
  LegalArchiveUnexpectedSource,
} from "@/models/fiscal/legal-archive"
import Link from "next/link"

const DOCUMENT_KIND_MESSAGE_KEYS = {
  issued_invoice: "tax.review.documentKind.issued_invoice",
  payroll_placeholder: "tax.review.documentKind.payroll_placeholder",
  received_invoice: "tax.review.documentKind.received_invoice",
} as const satisfies Record<string, MessageKey>

const ATTACHMENT_STATUS_MESSAGE_KEYS = {
  available: "tax.archive.attachmentStatus.available",
  missing: "tax.archive.attachmentStatus.missing",
} as const satisfies Record<string, MessageKey>

type ArchiveDocumentKind = keyof typeof DOCUMENT_KIND_MESSAGE_KEYS
type ArchiveAttachmentStatus = keyof typeof ATTACHMENT_STATUS_MESSAGE_KEYS

function isArchiveDocumentKind(documentKind: string): documentKind is ArchiveDocumentKind {
  return documentKind in DOCUMENT_KIND_MESSAGE_KEYS
}

function isArchiveAttachmentStatus(status: string): status is ArchiveAttachmentStatus {
  return status in ATTACHMENT_STATUS_MESSAGE_KEYS
}

function getDocumentKindLabel(documentKind: string | null, t: Translator) {
  if (!documentKind) {
    return t("tax.review.documentKind.unknown")
  }

  return t(
    isArchiveDocumentKind(documentKind)
      ? DOCUMENT_KIND_MESSAGE_KEYS[documentKind]
      : "tax.review.documentKind.unknown"
  )
}

function getAttachmentStatusLabel(status: string, t: Translator) {
  return t(
    isArchiveAttachmentStatus(status)
      ? ATTACHMENT_STATUS_MESSAGE_KEYS[status]
      : "tax.archive.attachmentStatus.missing"
  )
}

function ArchiveExpectedSourceRow({
  source,
  t,
}: {
  source: LegalArchiveExpectedSource
  t: Translator
}) {
  return (
    <TableRow>
      <TableCell>
        <div className="space-y-1">
          <p className="font-medium">{getDocumentKindLabel(source.documentKind, t)}</p>
          <p className="break-all font-mono text-xs text-muted-foreground">{source.fiscalDocumentId}</p>
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-2">
          <p className="break-all font-mono text-xs">{source.sourceTransactionId}</p>
          <Button asChild variant="ghost" size="sm" className="h-auto px-0 text-xs">
            <Link href={`/transactions/${source.sourceTransactionId}`}>
              {t("tax.archive.detail.openSource")}
            </Link>
          </Button>
        </div>
      </TableCell>
      <TableCell>{source.issueDate ?? "—"}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-2">
          {source.includesVat ? <Badge variant="outline">{t("tax.archive.scope.vat")}</Badge> : null}
          {source.includesWithholding ? (
            <Badge variant="outline">{t("tax.archive.scope.withholding")}</Badge>
          ) : null}
          {!source.includesVat && !source.includesWithholding ? (
            <span className="text-sm text-muted-foreground">{t("tax.archive.scope.none")}</span>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-2">
          <Badge variant={source.availableAttachmentCount > 0 ? "secondary" : "outline"}>
            {getAttachmentStatusLabel(source.attachmentStatus, t)}
          </Badge>
          <p className="text-xs text-muted-foreground">
            {t("tax.archive.detail.attachmentCount", {
              resolved: source.availableAttachmentCount,
              expected: source.expectedAttachmentCount,
            })}
          </p>
        </div>
      </TableCell>
      <TableCell>
        {source.attachments.length > 0 ? (
          <div className="space-y-2">
            {source.attachments.map((attachment) => (
              <div key={attachment.id} className="text-sm">
                <Link
                  href={`/files/download/${attachment.id}`}
                  className="underline underline-offset-4"
                >
                  {attachment.filename}
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">
            {t("tax.archive.detail.noResolvedAttachments")}
          </span>
        )}
      </TableCell>
      <TableCell>
        <ReviewStatusBadge status={source.reviewStatus} t={t} />
      </TableCell>
    </TableRow>
  )
}

function ArchiveUnexpectedSourceRow({
  source,
}: {
  source: LegalArchiveUnexpectedSource
}) {
  return (
    <TableRow>
      <TableCell className="break-all font-mono text-xs">{source.sourceTransactionId}</TableCell>
      <TableCell className="text-right">{source.attachmentCount}</TableCell>
      <TableCell>
        <div className="space-y-2">
          {source.attachments.map((attachment) => (
            <div key={attachment.id} className="text-sm">
              <Link
                href={`/files/download/${attachment.id}`}
                className="underline underline-offset-4"
              >
                {attachment.filename}
              </Link>
            </div>
          ))}
        </div>
      </TableCell>
    </TableRow>
  )
}

function formatArchiveFilingStatus(status: string) {
  return status.replaceAll("_", " ")
}

function ArchiveFilingRow({
  filing,
}: {
  filing: LegalArchiveFiling
}) {
  return (
    <TableRow>
      <TableCell>
        <div className="space-y-1">
          <p className="font-medium">Modelo {filing.code}</p>
          <p className="text-xs text-muted-foreground">{filing.dueDate ?? "Sin fecha"}</p>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={filing.hasDraftSnapshot ? "secondary" : "outline"}>
          {filing.hasDraftSnapshot ? "Borrador disponible" : "Sin borrador"}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={filing.missingEvidence.length === 0 ? "secondary" : "outline"}>
          {filing.attachedEvidence.length}/{filing.requiredEvidence.length} evidencias
        </Badge>
        {filing.missingEvidence.length > 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Falta: {filing.missingEvidence.join(", ")}
          </p>
        ) : null}
      </TableCell>
      <TableCell>
        {filing.filingReceipt ? (
          <Link
            href={`/files/download/${filing.filingReceipt.id}`}
            className="underline underline-offset-4"
          >
            {filing.filingReceipt.filename}
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">Sin justificante</span>
        )}
      </TableCell>
      <TableCell>
        <div className="space-y-2">
          <Badge variant={filing.filingReference ? "secondary" : "outline"}>
            {filing.filingReference ? formatArchiveFilingStatus(filing.status) : "Pendiente"}
          </Badge>
          {filing.filingReference ? (
            <div className="text-xs text-muted-foreground">
              <p>{filing.filingReference}</p>
              {filing.filedAt ? <p>{filing.filedAt.slice(0, 10)}</p> : null}
            </div>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  )
}

export function ArchiveManifestView({
  detail,
  t,
}: {
  detail: LegalArchivePeriodDetail
  t: Translator
}) {
  return (
    <section className="space-y-6" aria-label={t("tax.archive.detail.sectionLabel")}>
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="gap-2">
            <CardDescription>{t("tax.archive.summary.expectedSources")}</CardDescription>
            <CardTitle className="text-3xl tracking-tight">
              {detail.manifest.totals.expectedSourceCount}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="gap-2">
            <CardDescription>{t("tax.archive.summary.availableSources")}</CardDescription>
            <CardTitle className="text-3xl tracking-tight">
              {detail.manifest.totals.availableSourceCount}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="gap-2">
            <CardDescription>{t("tax.archive.summary.missingSources")}</CardDescription>
            <CardTitle className="text-3xl tracking-tight">
              {detail.manifest.totals.missingSourceCount}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="gap-2">
            <CardDescription>{t("tax.archive.summary.unexpectedSources")}</CardDescription>
            <CardTitle className="text-3xl tracking-tight">
              {detail.manifest.totals.unexpectedSourceCount}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="gap-2">
          <CardTitle>{t("tax.archive.detail.traceability.title")}</CardTitle>
          <CardDescription>{t("tax.archive.detail.traceability.description")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">{t("tax.archive.fields.referencedAttachments")}</p>
            <p className="mt-2 text-2xl font-semibold">
              {detail.attachmentResolution.referencedAttachmentCount}
            </p>
          </div>

          <div className="rounded-lg border bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">{t("tax.archive.fields.resolvedAttachments")}</p>
            <p className="mt-2 text-2xl font-semibold">
              {detail.attachmentResolution.resolvedAttachmentCount}
            </p>
          </div>

          <div className="rounded-lg border bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">{t("tax.archive.fields.unresolvedAttachments")}</p>
            <p className="mt-2 text-2xl font-semibold">
              {detail.attachmentResolution.unresolvedAttachmentCount}
            </p>
          </div>
        </CardContent>
      </Card>

      {detail.manifest.filings.length > 0 ? (
        <Card className="shadow-sm">
          <CardHeader className="gap-2">
            <CardTitle>Expedientes de presentación</CardTitle>
            <CardDescription>
              Borradores, justificantes y huecos de trazabilidad de las obligaciones fiscales del
              trimestre.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Obligación</TableHead>
                  <TableHead>Borrador</TableHead>
                  <TableHead>Evidencias</TableHead>
                  <TableHead>Justificante</TableHead>
                  <TableHead>Presentación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.manifest.filings.map((filing) => (
                  <ArchiveFilingRow key={filing.obligationId} filing={filing} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {detail.unresolvedSources.length > 0 ? (
        <Card className="shadow-sm">
          <CardHeader className="gap-2">
            <CardTitle>{t("tax.archive.detail.unresolved.title")}</CardTitle>
            <CardDescription>{t("tax.archive.detail.unresolved.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("tax.archive.fields.sourceTransaction")}</TableHead>
                  <TableHead className="text-right">
                    {t("tax.archive.fields.referencedAttachments")}
                  </TableHead>
                  <TableHead className="text-right">{t("tax.archive.fields.resolvedAttachments")}</TableHead>
                  <TableHead className="text-right">
                    {t("tax.archive.fields.unresolvedAttachments")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.unresolvedSources.map((source) => (
                  <TableRow key={source.sourceTransactionId}>
                    <TableCell className="break-all font-mono text-xs">
                      {source.sourceTransactionId}
                    </TableCell>
                    <TableCell className="text-right">{source.referencedAttachmentCount}</TableCell>
                    <TableCell className="text-right">{source.resolvedAttachmentCount}</TableCell>
                    <TableCell className="text-right">{source.unresolvedAttachmentCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <Card className="shadow-sm">
        <CardHeader className="gap-2">
          <CardTitle>{t("tax.archive.detail.expected.title")}</CardTitle>
          <CardDescription>{t("tax.archive.detail.expected.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {detail.manifest.sources.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("tax.archive.fields.document")}</TableHead>
                  <TableHead>{t("tax.archive.fields.sourceTransaction")}</TableHead>
                  <TableHead>{t("tax.archive.fields.issueDate")}</TableHead>
                  <TableHead>{t("tax.archive.fields.scope")}</TableHead>
                  <TableHead>{t("tax.archive.fields.attachmentStatus")}</TableHead>
                  <TableHead>{t("tax.archive.fields.attachments")}</TableHead>
                  <TableHead>{t("tax.archive.fields.reviewStatus")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.manifest.sources.map((source) => (
                  <ArchiveExpectedSourceRow
                    key={source.fiscalDocumentId}
                    source={source}
                    t={t}
                  />
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">{t("tax.archive.detail.expected.empty")}</p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="gap-2">
          <CardTitle>{t("tax.archive.detail.unexpectedSources.title")}</CardTitle>
          <CardDescription>{t("tax.archive.detail.unexpectedSources.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {detail.manifest.unexpectedSources.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("tax.archive.fields.sourceTransaction")}</TableHead>
                  <TableHead className="text-right">{t("tax.archive.fields.attachmentsCount")}</TableHead>
                  <TableHead>{t("tax.archive.fields.attachments")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.manifest.unexpectedSources.map((source) => (
                  <ArchiveUnexpectedSourceRow key={source.sourceTransactionId} source={source} />
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("tax.archive.detail.unexpectedSources.empty")}
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
