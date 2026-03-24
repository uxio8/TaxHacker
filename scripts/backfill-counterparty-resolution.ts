import { pathToFileURL } from "node:url"

import {
  FISCAL_AUDIT_EVENT_COUNTERPARTY_AUTO_LINKED,
  appendFiscalAuditEvent,
} from "../models/fiscal/audit-log.ts"
import {
  buildCounterpartyResolutionDocumentInput,
  COUNTERPARTY_RESOLUTION_DECISION,
  mapCounterpartiesToResolutionInput,
  resolveCounterpartyResolution,
  type CounterpartyResolution,
  type CounterpartyResolutionCounterpartyInput,
} from "../models/fiscal/counterparty-resolution.ts"
import { getCounterparties } from "../models/fiscal/counterparties.ts"
import {
  listTransactionFiscalDocuments,
  upsertTransactionFiscal,
  type TransactionFiscalDocument,
} from "../models/fiscal/transaction-fiscal.ts"

export type CounterpartyResolutionBackfillOptions = {
  ownerScopeId: string
  dryRun?: boolean
  apply?: boolean
}

export type CounterpartyResolutionBackfillReport = {
  ownerScopeId: string
  scanned: number
  autoLinked: number
  stillInReview: number
  conflictsFound: number
  applied: number
  dryRun: boolean
}

type CounterpartyResolutionBackfillDependencies = {
  listDocuments: (ownerScopeId: string) => Promise<TransactionFiscalDocument[]>
  listCounterparties: (
    ownerScopeId: string
  ) => Promise<CounterpartyResolutionCounterpartyInput[]>
  applyAutoLink: (
    ownerScopeId: string,
    document: TransactionFiscalDocument,
    resolution: CounterpartyResolution
  ) => Promise<void>
}

function trimToNull(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function normalizeOptions(
  options: CounterpartyResolutionBackfillOptions
): Required<Pick<CounterpartyResolutionBackfillOptions, "ownerScopeId">> & {
  dryRun: boolean
  apply: boolean
} {
  const ownerScopeId = trimToNull(options.ownerScopeId)

  if (!ownerScopeId) {
    throw new Error("ownerScopeId es obligatorio para el backfill de contraparte")
  }

  const apply = options.apply === true
  const dryRun = options.dryRun === true || !apply

  if (apply && options.dryRun === true) {
    throw new Error("No puedes combinar --apply con --dry-run")
  }

  return {
    ownerScopeId,
    apply,
    dryRun,
  }
}

function needsCounterpartyResolution(document: TransactionFiscalDocument) {
  return !trimToNull(document.header.counterparty_id)
}

function shouldAutoLink(resolution: CounterpartyResolution) {
  return (
    resolution.decision === COUNTERPARTY_RESOLUTION_DECISION.AUTO_LINKED
    && Boolean(trimToNull(resolution.linked_counterparty_id))
  )
}

function buildAutoLinkReason(document: TransactionFiscalDocument, resolution: CounterpartyResolution) {
  return [
    "Backfill contraparte:",
    `autolink conservador ${resolution.evidence.match_basis}`,
    `documento=${document.header.fiscal_document_id}`,
  ].join(" ")
}

async function resolveDependencies(
  dependencies?: Partial<CounterpartyResolutionBackfillDependencies>
): Promise<CounterpartyResolutionBackfillDependencies> {
  return {
    listDocuments: dependencies?.listDocuments ?? listTransactionFiscalDocuments,
    listCounterparties: dependencies?.listCounterparties ?? getCounterparties,
    applyAutoLink:
      dependencies?.applyAutoLink
      ?? (async (ownerScopeId, document, resolution) => {
        const linkedCounterpartyId = trimToNull(resolution.linked_counterparty_id)

        if (!linkedCounterpartyId) {
          throw new Error("El auto-link requiere linked_counterparty_id")
        }

        const nextDocument = {
          header: {
            ...document.header,
            counterparty_id: linkedCounterpartyId,
          },
          lines: document.lines.map((line) => ({
            ...line,
          })),
        }

        await upsertTransactionFiscal(ownerScopeId, nextDocument, undefined, {
          auditActor: {
            type: "system",
          },
          auditReason: buildAutoLinkReason(document, resolution),
        })

        await appendFiscalAuditEvent(ownerScopeId, {
          event: FISCAL_AUDIT_EVENT_COUNTERPARTY_AUTO_LINKED,
          fiscalDocumentId: document.header.fiscal_document_id,
          actor: {
            type: "system",
          },
          reason: buildAutoLinkReason(document, resolution),
          details: {
            rule_version: resolution.rule_version,
            previous_counterparty_id: document.header.counterparty_id,
            chosen_counterparty_id: linkedCounterpartyId,
            detected_counterparty_name: document.header.counterparty_name,
            detected_counterparty_tax_id: document.header.counterparty_tax_id,
          },
        })
      }),
  }
}

export async function runCounterpartyResolutionBackfill(
  options: CounterpartyResolutionBackfillOptions,
  dependencies?: Partial<CounterpartyResolutionBackfillDependencies>
): Promise<CounterpartyResolutionBackfillReport> {
  const runtime = await resolveDependencies(dependencies)
  const normalized = normalizeOptions(options)
  const [allDocuments, counterparties] = await Promise.all([
    runtime.listDocuments(normalized.ownerScopeId),
    runtime.listCounterparties(normalized.ownerScopeId),
  ])
  const documents = allDocuments.filter(needsCounterpartyResolution)

  const report: CounterpartyResolutionBackfillReport = {
    ownerScopeId: normalized.ownerScopeId,
    scanned: documents.length,
    autoLinked: 0,
    stillInReview: 0,
    conflictsFound: 0,
    applied: 0,
    dryRun: normalized.dryRun,
  }

  for (const document of documents) {
    const resolution = resolveCounterpartyResolution({
      ownerScopeId: normalized.ownerScopeId,
      document: buildCounterpartyResolutionDocumentInput({
        fiscal_document_id: document.header.fiscal_document_id,
        source_transaction_id: document.header.source_transaction_id,
        document_kind: document.header.document_kind,
        counterparty_id: document.header.counterparty_id,
        counterparty_name: document.header.counterparty_name,
        counterparty_tax_id: document.header.counterparty_tax_id,
        counterparty_role: document.header.counterparty_role,
        issue_date: document.header.issue_date,
        total_payable_cents: document.header.total_payable_cents,
        total_vat_cents: document.header.total_vat_cents,
        total_withholding_cents: document.header.total_withholding_cents,
      }),
      counterparties: mapCounterpartiesToResolutionInput(counterparties),
    })

    if (shouldAutoLink(resolution)) {
      report.autoLinked += 1

      if (normalized.apply) {
        await runtime.applyAutoLink(normalized.ownerScopeId, document, resolution)
        report.applied += 1
      }

      continue
    }

    report.stillInReview += 1

    if (resolution.evidence.conflict_reason) {
      report.conflictsFound += 1
    }
  }

  return report
}

function printReport(report: CounterpartyResolutionBackfillReport) {
  const lines = [
    `Owner scope: ${report.ownerScopeId}`,
    `Documentos escaneados: ${report.scanned}`,
    `Auto-link seguros detectados: ${report.autoLinked}`,
    `Siguen en revisión: ${report.stillInReview}`,
    `Conflictos detectados: ${report.conflictsFound}`,
    `Aplicados: ${report.applied}`,
    `Modo: ${report.dryRun ? "dry-run" : "apply"}`,
  ]

  console.log(lines.join("\n"))
}

function parseCliOptions(argv: string[]): CounterpartyResolutionBackfillOptions {
  let ownerScopeId: string | null = null
  let dryRun = false
  let apply = false

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    if (argument === "--apply") {
      apply = true
      continue
    }

    if (argument === "--dry-run") {
      dryRun = true
      continue
    }

    if (argument === "--owner-scope-id") {
      ownerScopeId = trimToNull(argv[index + 1]) ?? null
      index += 1
      continue
    }

    if (argument.startsWith("--owner-scope-id=")) {
      ownerScopeId = trimToNull(argument.slice("--owner-scope-id=".length)) ?? null
    }
  }

  return {
    ownerScopeId: ownerScopeId ?? "",
    dryRun,
    apply,
  }
}

export function isExecutedAsScript(importMetaUrl: string, argv1: string | undefined) {
  if (!argv1) {
    return false
  }

  return pathToFileURL(argv1).href === importMetaUrl
}

async function main() {
  const report = await runCounterpartyResolutionBackfill(parseCliOptions(process.argv.slice(2)))
  printReport(report)
}

if (isExecutedAsScript(import.meta.url, process.argv[1])) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
