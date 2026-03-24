import { getQuarterlyDraftByPeriodKey, listQuarterlyDrafts, type QuarterlyDraft } from "../fiscal/quarterly-draft.ts"
import { listTransactionFiscalDocuments } from "../fiscal/transaction-fiscal.ts"
import { buildModel303Draft, type Model303Draft } from "./model-303.ts"

export type Model303Readiness = {
  status: "ready" | "attention_required" | "missing_period"
  label: string
  detail: string
  summary: {
    totalDocuments: number
    model303CandidateCount: number
    reviewDocumentCount: number
    blockingDocumentCount: number
    skippedDocumentCount: number
  }
}

export type Model303LoaderResult = {
  quarterLabel: string
  periodKey: string
  draft: Model303Draft
  readiness: Model303Readiness
  availablePeriodKeys: string[]
}

type Model303LoaderDependencies = {
  listQuarterlyDrafts?: typeof listQuarterlyDrafts
  getQuarterlyDraftByPeriodKey?: typeof getQuarterlyDraftByPeriodKey
  listTransactionFiscalDocuments?: typeof listTransactionFiscalDocuments
}

function trimToNull(value?: string | null) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function isActiveQuarterCandidate(draft: QuarterlyDraft) {
  return draft.operationalStatus.code !== "closed" && draft.operationalStatus.code !== "presented"
}

function pickSelectedDraft(drafts: QuarterlyDraft[]) {
  return drafts.find(isActiveQuarterCandidate) ?? drafts[0] ?? null
}

function buildReadiness({
  totalDocuments,
  includedDocumentCount,
  reviewDocumentCount,
  blockingDocumentCount,
}: {
  totalDocuments: number
  includedDocumentCount: number
  reviewDocumentCount: number
  blockingDocumentCount: number
}): Model303Readiness {
  const skippedDocumentCount = Math.max(totalDocuments - includedDocumentCount, 0)
  const needsAttention =
    reviewDocumentCount > 0 || blockingDocumentCount > 0 || skippedDocumentCount > 0

  if (!totalDocuments) {
    return {
      status: "missing_period",
      label: "Sin hechos fiscales listos",
      detail: "El trimestre existe, pero todavía no hay documentos con impacto en IVA listos para entrar en el borrador.",
      summary: {
        totalDocuments,
        model303CandidateCount: includedDocumentCount,
        reviewDocumentCount,
        blockingDocumentCount,
        skippedDocumentCount,
      },
    }
  }

  if (needsAttention) {
    return {
      status: "attention_required",
      label: "Requiere atención",
      detail:
        "Hay documentos del trimestre pendientes de revisión, bloqueados o todavía fuera del borrador del 303.",
      summary: {
        totalDocuments,
        model303CandidateCount: includedDocumentCount,
        reviewDocumentCount,
        blockingDocumentCount,
        skippedDocumentCount,
      },
    }
  }

  return {
    status: "ready",
    label: "Listo para preparar",
    detail: "Todos los documentos con impacto en IVA del trimestre ya están entrando en el borrador del 303.",
    summary: {
      totalDocuments,
      model303CandidateCount: includedDocumentCount,
      reviewDocumentCount,
      blockingDocumentCount,
      skippedDocumentCount,
    },
  }
}

function countRelevantVatDocuments(periodKey: string, documents: Awaited<ReturnType<typeof listTransactionFiscalDocuments>>) {
  let totalDocuments = 0
  let reviewDocumentCount = 0
  let blockingDocumentCount = 0

  for (const document of documents) {
    if (document.header.vat_period_assignment?.period_key !== periodKey) {
      continue
    }

    totalDocuments += 1

    if (document.header.review_status === "blocked") {
      blockingDocumentCount += 1
      continue
    }

    if (
      document.header.review_status === "needs_review" ||
      document.header.review_status === "pending"
    ) {
      reviewDocumentCount += 1
    }
  }

  return {
    totalDocuments,
    reviewDocumentCount,
    blockingDocumentCount,
  }
}

export async function loadModel303ForTenant(
  input: {
    ownerScopeId: string
    requestedPeriodKey?: string | null
  },
  dependencies: Model303LoaderDependencies = {}
): Promise<Model303LoaderResult | null> {
  const normalizedOwnerScopeId = trimToNull(input.ownerScopeId)

  if (!normalizedOwnerScopeId) {
    throw new Error("ownerScopeId es obligatorio para cargar el modelo 303")
  }

  const loadDrafts = dependencies.listQuarterlyDrafts ?? listQuarterlyDrafts
  const loadDraftByPeriodKey =
    dependencies.getQuarterlyDraftByPeriodKey ?? getQuarterlyDraftByPeriodKey
  const loadDocuments =
    dependencies.listTransactionFiscalDocuments ?? listTransactionFiscalDocuments

  const requestedPeriodKey = trimToNull(input.requestedPeriodKey)
  const drafts = requestedPeriodKey ? [] : await loadDrafts(normalizedOwnerScopeId)
  const selectedDraft = requestedPeriodKey
    ? await loadDraftByPeriodKey(normalizedOwnerScopeId, requestedPeriodKey)
    : pickSelectedDraft(drafts)

  if (!selectedDraft) {
    return null
  }

  const documents = await loadDocuments(normalizedOwnerScopeId)
  const draft = buildModel303Draft(documents, selectedDraft.period.periodKey)
  const counts = countRelevantVatDocuments(selectedDraft.period.periodKey, documents)

  return {
    quarterLabel: selectedDraft.period.periodKey,
    periodKey: selectedDraft.period.periodKey,
    draft,
    readiness: buildReadiness({
      totalDocuments: counts.totalDocuments,
      includedDocumentCount: draft.documents_included.length,
      reviewDocumentCount: counts.reviewDocumentCount,
      blockingDocumentCount: counts.blockingDocumentCount,
    }),
    availablePeriodKeys: requestedPeriodKey
      ? [selectedDraft.period.periodKey]
      : drafts.map((candidate) => candidate.period.periodKey),
  }
}

export async function loadModel303Draft(
  ownerScopeId: string,
  dependencies: Model303LoaderDependencies & {
    periodKey?: string | null
  } = {}
): Promise<Model303LoaderResult | null> {
  return loadModel303ForTenant(
    {
      ownerScopeId,
      requestedPeriodKey: dependencies.periodKey,
    },
    dependencies
  )
}
