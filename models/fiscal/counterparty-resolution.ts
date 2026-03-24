export const COUNTERPARTY_RESOLUTION_RULE_VERSION = "counterparty-resolution/v1" as const

const COUNTERPARTY_RESOLUTION_DECISION = {
  AUTO_LINKED: "auto_linked",
  SUGGESTED_REQUIRES_CONFIRMATION: "suggested_requires_confirmation",
  NEEDS_REVIEW_NO_SAFE_CANDIDATE: "needs_review_no_safe_candidate",
} as const

const MATERIALITY_BUCKET = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const

const COUNTERPARTY_MATCH_BASIS = {
  TAX_ID: "tax_id",
  NAME: "name",
  NONE: "none",
} as const

const COUNTERPARTY_MATCH_REASON = {
  TAX_ID_EXACT: "tax_id_exact",
  NAME_EXACT: "name_exact",
} as const

const COUNTERPARTY_CONFLICT_REASON = {
  DOCUMENT_COUNTERPARTY_ID_CONFLICT: "document_counterparty_id_conflict",
  MULTIPLE_NAME_CANDIDATES: "multiple_name_candidates",
  MULTIPLE_TAX_ID_CANDIDATES: "multiple_tax_id_candidates",
  NO_IDENTITY_SIGNAL: "no_identity_signal",
  NO_NAME_MATCH: "no_name_match",
  NO_TAX_ID_MATCH: "no_tax_id_match",
  NAME_MATCH_INACTIVE_ONLY: "name_match_inactive_only",
  TAX_ID_MATCH_INACTIVE_ONLY: "tax_id_match_inactive_only",
} as const

export type CounterpartyResolutionDecision =
  (typeof COUNTERPARTY_RESOLUTION_DECISION)[keyof typeof COUNTERPARTY_RESOLUTION_DECISION]

export type MaterialityBucket =
  (typeof MATERIALITY_BUCKET)[keyof typeof MATERIALITY_BUCKET]

export type CounterpartyMatchBasis =
  (typeof COUNTERPARTY_MATCH_BASIS)[keyof typeof COUNTERPARTY_MATCH_BASIS]

export type CounterpartyMatchReason =
  (typeof COUNTERPARTY_MATCH_REASON)[keyof typeof COUNTERPARTY_MATCH_REASON]

export type CounterpartyConflictReason =
  (typeof COUNTERPARTY_CONFLICT_REASON)[keyof typeof COUNTERPARTY_CONFLICT_REASON]

export type CounterpartyResolutionDocumentInput = {
  counterparty_id: string | null
  counterparty_name: string | null
  counterparty_tax_id: string | null
  counterparty_role: string | null
  document_kind: string | null
  total_payable_cents: number | null
  total_vat_cents: number | null
  total_withholding_cents: number | null
  source_transaction_id: string
  fiscal_document_id: string
  issue_date: string | null
}

export type CounterpartyResolutionCounterpartyInput = {
  id: string
  displayName: string
  normalizedName: string
  taxId: string | null
  taxIdNormalized: string | null
  isActive: boolean
  canonicalIdentityKey: string
}

export type CounterpartyResolutionInput = {
  ownerScopeId: string
  document: CounterpartyResolutionDocumentInput
  counterparties: CounterpartyResolutionCounterpartyInput[]
}

export type CounterpartyResolutionEvidence = {
  owner_scope_id: string
  fiscal_document_id: string
  source_transaction_id: string
  issue_date: string | null
  document_kind: string | null
  counterparty_role: string | null
  match_basis: CounterpartyMatchBasis
  normalized_tax_id: string | null
  normalized_name: string | null
  active_candidate_count: number
  total_candidate_count: number
  conflict_reason: CounterpartyConflictReason | null
}

export type CounterpartyResolutionRelevantCandidate = {
  id: string
  display_name: string
  canonical_identity_key: string
  tax_id: string | null
  tax_id_normalized: string | null
  is_active: boolean
  match_reasons: CounterpartyMatchReason[]
}

export type CounterpartyResolution = {
  rule_version: typeof COUNTERPARTY_RESOLUTION_RULE_VERSION
  decision: CounterpartyResolutionDecision
  materiality_bucket: MaterialityBucket
  linked_counterparty_id: string | null
  evidence: CounterpartyResolutionEvidence
  relevant_candidates: CounterpartyResolutionRelevantCandidate[]
}

export type CounterpartyResolutionQualityStatus = "reliable" | "needs_review"

function trimToNull(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function normalizeOwnerScopeId(value: string): string {
  const normalized = value.trim()

  if (!normalized) {
    throw new Error("ownerScopeId es obligatorio")
  }

  return normalized
}

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ")
}

function normalizeCounterpartyTaxId(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "")
  return normalized || null
}

function normalizeCounterpartyName(value: string | null | undefined): string | null {
  const trimmed = trimToNull(value)

  if (!trimmed) {
    return null
  }

  const normalized = collapseWhitespace(
    trimmed
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toUpperCase()
      .replace(/[^0-9A-Z]+/g, " ")
  )

  return normalized || null
}

function normalizeInteger(value: number | null | undefined): number {
  return Number.isInteger(value) ? (value as number) : 0
}

function getMaterialityBucket(
  document: CounterpartyResolutionDocumentInput
): MaterialityBucket {
  if (Math.abs(normalizeInteger(document.total_withholding_cents)) > 0) {
    return MATERIALITY_BUCKET.HIGH
  }

  const absoluteMax = Math.max(
    Math.abs(normalizeInteger(document.total_payable_cents)),
    Math.abs(normalizeInteger(document.total_vat_cents)),
    Math.abs(normalizeInteger(document.total_withholding_cents))
  )

  if (absoluteMax >= 100_000) {
    return MATERIALITY_BUCKET.HIGH
  }

  if (absoluteMax >= 10_000) {
    return MATERIALITY_BUCKET.MEDIUM
  }

  return MATERIALITY_BUCKET.LOW
}

export function getCounterpartyResolutionMaterialityBucket(
  document: CounterpartyResolutionDocumentInput
): MaterialityBucket {
  return getMaterialityBucket(document)
}

function buildRelevantCandidate(
  counterparty: CounterpartyResolutionCounterpartyInput,
  normalizedTaxId: string | null,
  normalizedName: string | null
): CounterpartyResolutionRelevantCandidate {
  const matchReasons: CounterpartyMatchReason[] = []

  if (normalizedTaxId && counterparty.taxIdNormalized === normalizedTaxId) {
    matchReasons.push(COUNTERPARTY_MATCH_REASON.TAX_ID_EXACT)
  }

  if (normalizedName && counterparty.normalizedName === normalizedName) {
    matchReasons.push(COUNTERPARTY_MATCH_REASON.NAME_EXACT)
  }

  return {
    id: counterparty.id,
    display_name: counterparty.displayName,
    canonical_identity_key: counterparty.canonicalIdentityKey,
    tax_id: counterparty.taxId,
    tax_id_normalized: counterparty.taxIdNormalized,
    is_active: counterparty.isActive,
    match_reasons: matchReasons,
  }
}

function compareRelevantCandidates(
  left: CounterpartyResolutionRelevantCandidate,
  right: CounterpartyResolutionRelevantCandidate
): number {
  if (left.is_active !== right.is_active) {
    return left.is_active ? -1 : 1
  }

  return left.display_name.localeCompare(right.display_name, "es")
}

function buildResolution(
  input: CounterpartyResolutionInput,
  decision: CounterpartyResolutionDecision,
  materialityBucket: MaterialityBucket,
  linkedCounterpartyId: string | null,
  matchBasis: CounterpartyMatchBasis,
  normalizedTaxId: string | null,
  normalizedName: string | null,
  totalCandidateCount: number,
  activeCandidateCount: number,
  conflictReason: CounterpartyConflictReason | null,
  relevantCandidates: CounterpartyResolutionRelevantCandidate[]
): CounterpartyResolution {
  return {
    rule_version: COUNTERPARTY_RESOLUTION_RULE_VERSION,
    decision,
    materiality_bucket: materialityBucket,
    linked_counterparty_id: linkedCounterpartyId,
    evidence: {
      owner_scope_id: input.ownerScopeId,
      fiscal_document_id: input.document.fiscal_document_id,
      source_transaction_id: input.document.source_transaction_id,
      issue_date: trimToNull(input.document.issue_date),
      document_kind: trimToNull(input.document.document_kind),
      counterparty_role: trimToNull(input.document.counterparty_role),
      match_basis: matchBasis,
      normalized_tax_id: normalizedTaxId,
      normalized_name: normalizedName,
      active_candidate_count: activeCandidateCount,
      total_candidate_count: totalCandidateCount,
      conflict_reason: conflictReason,
    },
    relevant_candidates: relevantCandidates.sort(compareRelevantCandidates),
  }
}

export function getCounterpartyResolutionQualityStatus(
  resolution: Pick<CounterpartyResolution, "decision" | "evidence">
): CounterpartyResolutionQualityStatus {
  if (
    resolution.decision === COUNTERPARTY_RESOLUTION_DECISION.AUTO_LINKED &&
    resolution.evidence.match_basis === COUNTERPARTY_MATCH_BASIS.TAX_ID
  ) {
    return "reliable"
  }

  return "needs_review"
}

function hasDocumentCounterpartyConflict(
  documentCounterpartyId: string | null,
  candidateId: string
): boolean {
  const normalizedDocumentCounterpartyId = trimToNull(documentCounterpartyId)
  return normalizedDocumentCounterpartyId !== null && normalizedDocumentCounterpartyId !== candidateId
}

export function resolveCounterpartyResolution(
  input: CounterpartyResolutionInput
): CounterpartyResolution {
  const ownerScopeId = normalizeOwnerScopeId(input.ownerScopeId)
  const normalizedTaxId = normalizeCounterpartyTaxId(input.document.counterparty_tax_id)
  const normalizedName = normalizeCounterpartyName(input.document.counterparty_name)
  const materialityBucket = getMaterialityBucket(input.document)

  const scopedInput: CounterpartyResolutionInput = {
    ...input,
    ownerScopeId,
  }

  if (normalizedTaxId) {
    const taxIdCandidates = input.counterparties.filter(
      (counterparty) => counterparty.taxIdNormalized === normalizedTaxId
    )
    const activeTaxIdCandidates = taxIdCandidates.filter((counterparty) => counterparty.isActive)
    const relevantCandidates = taxIdCandidates.map((counterparty) =>
      buildRelevantCandidate(counterparty, normalizedTaxId, normalizedName)
    )

    if (taxIdCandidates.length > 1) {
      return buildResolution(
        scopedInput,
        COUNTERPARTY_RESOLUTION_DECISION.NEEDS_REVIEW_NO_SAFE_CANDIDATE,
        materialityBucket,
        null,
        COUNTERPARTY_MATCH_BASIS.TAX_ID,
        normalizedTaxId,
        normalizedName,
        taxIdCandidates.length,
        activeTaxIdCandidates.length,
        COUNTERPARTY_CONFLICT_REASON.MULTIPLE_TAX_ID_CANDIDATES,
        relevantCandidates
      )
    }

    if (taxIdCandidates.length === 1 && activeTaxIdCandidates.length === 0) {
      return buildResolution(
        scopedInput,
        COUNTERPARTY_RESOLUTION_DECISION.NEEDS_REVIEW_NO_SAFE_CANDIDATE,
        materialityBucket,
        null,
        COUNTERPARTY_MATCH_BASIS.TAX_ID,
        normalizedTaxId,
        normalizedName,
        1,
        0,
        COUNTERPARTY_CONFLICT_REASON.TAX_ID_MATCH_INACTIVE_ONLY,
        relevantCandidates
      )
    }

    if (activeTaxIdCandidates.length === 1) {
      const candidate = activeTaxIdCandidates[0]

      if (hasDocumentCounterpartyConflict(input.document.counterparty_id, candidate.id)) {
        return buildResolution(
          scopedInput,
          COUNTERPARTY_RESOLUTION_DECISION.NEEDS_REVIEW_NO_SAFE_CANDIDATE,
          materialityBucket,
          null,
          COUNTERPARTY_MATCH_BASIS.TAX_ID,
          normalizedTaxId,
          normalizedName,
          1,
          1,
          COUNTERPARTY_CONFLICT_REASON.DOCUMENT_COUNTERPARTY_ID_CONFLICT,
          relevantCandidates
        )
      }

      return buildResolution(
        scopedInput,
        COUNTERPARTY_RESOLUTION_DECISION.AUTO_LINKED,
        materialityBucket,
        candidate.id,
        COUNTERPARTY_MATCH_BASIS.TAX_ID,
        normalizedTaxId,
        normalizedName,
        1,
        1,
        null,
        relevantCandidates
      )
    }

    const fallbackCandidates = input.counterparties
      .filter((counterparty) => normalizedName && counterparty.normalizedName === normalizedName)
      .map((counterparty) => buildRelevantCandidate(counterparty, normalizedTaxId, normalizedName))

    return buildResolution(
      scopedInput,
      COUNTERPARTY_RESOLUTION_DECISION.NEEDS_REVIEW_NO_SAFE_CANDIDATE,
      materialityBucket,
      null,
      COUNTERPARTY_MATCH_BASIS.TAX_ID,
      normalizedTaxId,
      normalizedName,
      0,
      0,
      COUNTERPARTY_CONFLICT_REASON.NO_TAX_ID_MATCH,
      fallbackCandidates
    )
  }

  if (!normalizedName) {
    return buildResolution(
      scopedInput,
      COUNTERPARTY_RESOLUTION_DECISION.NEEDS_REVIEW_NO_SAFE_CANDIDATE,
      materialityBucket,
      null,
      COUNTERPARTY_MATCH_BASIS.NONE,
      null,
      null,
      0,
      0,
      COUNTERPARTY_CONFLICT_REASON.NO_IDENTITY_SIGNAL,
      []
    )
  }

  const nameCandidates = input.counterparties.filter(
    (counterparty) => counterparty.normalizedName === normalizedName
  )
  const activeNameCandidates = nameCandidates.filter((counterparty) => counterparty.isActive)
  const relevantCandidates = nameCandidates.map((counterparty) =>
    buildRelevantCandidate(counterparty, null, normalizedName)
  )

  if (nameCandidates.length === 0) {
    return buildResolution(
      scopedInput,
      COUNTERPARTY_RESOLUTION_DECISION.NEEDS_REVIEW_NO_SAFE_CANDIDATE,
      materialityBucket,
      null,
      COUNTERPARTY_MATCH_BASIS.NAME,
      null,
      normalizedName,
      0,
      0,
      COUNTERPARTY_CONFLICT_REASON.NO_NAME_MATCH,
      []
    )
  }

  if (activeNameCandidates.length === 0) {
    return buildResolution(
      scopedInput,
      COUNTERPARTY_RESOLUTION_DECISION.NEEDS_REVIEW_NO_SAFE_CANDIDATE,
      materialityBucket,
      null,
      COUNTERPARTY_MATCH_BASIS.NAME,
      null,
      normalizedName,
      nameCandidates.length,
      0,
      COUNTERPARTY_CONFLICT_REASON.NAME_MATCH_INACTIVE_ONLY,
      relevantCandidates
    )
  }

  if (activeNameCandidates.length > 1) {
    return buildResolution(
      scopedInput,
      COUNTERPARTY_RESOLUTION_DECISION.NEEDS_REVIEW_NO_SAFE_CANDIDATE,
      materialityBucket,
      null,
      COUNTERPARTY_MATCH_BASIS.NAME,
      null,
      normalizedName,
      nameCandidates.length,
      activeNameCandidates.length,
      COUNTERPARTY_CONFLICT_REASON.MULTIPLE_NAME_CANDIDATES,
      relevantCandidates
    )
  }

  const candidate = activeNameCandidates[0]

  if (hasDocumentCounterpartyConflict(input.document.counterparty_id, candidate.id)) {
    return buildResolution(
      scopedInput,
      COUNTERPARTY_RESOLUTION_DECISION.NEEDS_REVIEW_NO_SAFE_CANDIDATE,
      materialityBucket,
      null,
      COUNTERPARTY_MATCH_BASIS.NAME,
      null,
      normalizedName,
      1,
      1,
      COUNTERPARTY_CONFLICT_REASON.DOCUMENT_COUNTERPARTY_ID_CONFLICT,
      relevantCandidates
    )
  }

  return buildResolution(
    scopedInput,
    COUNTERPARTY_RESOLUTION_DECISION.SUGGESTED_REQUIRES_CONFIRMATION,
    materialityBucket,
    null,
    COUNTERPARTY_MATCH_BASIS.NAME,
    null,
    normalizedName,
    1,
    1,
    null,
    relevantCandidates
  )
}

export {
  COUNTERPARTY_CONFLICT_REASON,
  COUNTERPARTY_MATCH_BASIS,
  COUNTERPARTY_MATCH_REASON,
  COUNTERPARTY_RESOLUTION_DECISION,
  MATERIALITY_BUCKET,
}
