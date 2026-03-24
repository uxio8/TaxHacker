import {
  MOBILE_CONFIDENCE,
  MOBILE_REASON_CODE,
  type MobileConfidence,
  type MobileReasonCode,
} from "../models/mobile/types.ts"

type ParsedMobileDocument = Record<string, unknown> | null | undefined

type MobileTriageMetadataRecord = {
  source?: string
  disposition?: string
  reasonCode?: MobileReasonCode
  lastMobileActionAt?: string
}

type MobileInboxFileState = {
  isReviewed?: boolean
  metadata: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function hasValue(value: unknown) {
  if (typeof value === "string") {
    return value.trim().length > 0
  }

  return value !== null && value !== undefined
}

function normalizeMobileTriageDisposition(disposition: unknown) {
  if (disposition === "deferred" || disposition === "deferred_to_desktop") {
    return "deferred"
  }

  if (disposition === "pending") {
    return "pending"
  }

  return null
}

export function readMobileTriageMetadata(metadata: unknown): MobileTriageMetadataRecord | null {
  if (!isRecord(metadata) || !isRecord(metadata.mobileTriage)) {
    return null
  }

  const disposition = normalizeMobileTriageDisposition(metadata.mobileTriage.disposition)
  if (!disposition) {
    return null
  }

  return {
    source: typeof metadata.mobileTriage.source === "string" ? metadata.mobileTriage.source : undefined,
    disposition,
    reasonCode:
      typeof metadata.mobileTriage.reasonCode === "string"
        ? (metadata.mobileTriage.reasonCode as MobileReasonCode)
        : undefined,
    lastMobileActionAt:
      typeof metadata.mobileTriage.lastMobileActionAt === "string" ? metadata.mobileTriage.lastMobileActionAt : undefined,
  }
}

export function isActiveMobileInboxFile(file: MobileInboxFileState) {
  if (file.isReviewed) {
    return false
  }

  return readMobileTriageMetadata(file.metadata)?.source === "mobile_capture"
}

export function mergeMobileTriageMetadata(input: {
  metadata: unknown
  disposition: "pending" | "deferred"
  reasonCode?: MobileReasonCode
  updatedAt: string
}) {
  const currentMetadata = isRecord(input.metadata) ? input.metadata : {}
  const currentMobileTriage = readMobileTriageMetadata(currentMetadata) || {}
  const mobileTriageWithoutReasonCode = { ...currentMobileTriage }
  delete mobileTriageWithoutReasonCode.reasonCode

  return {
    ...currentMetadata,
    mobileTriage: {
      ...mobileTriageWithoutReasonCode,
      source: currentMobileTriage.source || "mobile_capture",
      disposition: input.disposition,
      lastMobileActionAt: input.updatedAt,
      ...(input.reasonCode ? { reasonCode: input.reasonCode } : {}),
    },
  }
}

export function clearMobileTriageMetadata(metadata: unknown) {
  if (!isRecord(metadata) || !("mobileTriage" in metadata)) {
    return metadata
  }

  const metadataWithoutMobileTriage = { ...metadata }
  delete metadataWithoutMobileTriage.mobileTriage
  return metadataWithoutMobileTriage
}

export function buildReviewedFileUpdate(input: { filename: string; path: string; metadata: unknown }) {
  return {
    filename: input.filename,
    path: input.path,
    isReviewed: true,
    metadata: clearMobileTriageMetadata(input.metadata),
  }
}

function getPresentHeuristicFieldCount(parsed: ParsedMobileDocument) {
  if (!parsed || typeof parsed !== "object") {
    return 0
  }

  const fields = ["merchant", "issuedAt", "total", "invoice_number"] as const

  return fields.reduce((count, fieldName) => count + (hasValue(parsed[fieldName]) ? 1 : 0), 0)
}

export function getMobileConfidence(parsed: ParsedMobileDocument): MobileConfidence {
  const presentFieldCount = getPresentHeuristicFieldCount(parsed)

  if (presentFieldCount === 4) {
    return MOBILE_CONFIDENCE.HIGH
  }

  if (presentFieldCount === 3) {
    return MOBILE_CONFIDENCE.MEDIUM
  }

  return MOBILE_CONFIDENCE.LOW
}

export function getMobileReviewReason(parsed: ParsedMobileDocument): MobileReasonCode {
  if (!parsed || typeof parsed !== "object") {
    return MOBILE_REASON_CODE.LOW_CONFIDENCE
  }

  const confidence = getMobileConfidence(parsed)
  if (confidence === MOBILE_CONFIDENCE.LOW) {
    return MOBILE_REASON_CODE.LOW_CONFIDENCE
  }

  if (!hasValue(parsed.issuedAt) || !hasValue(parsed.total)) {
    return MOBILE_REASON_CODE.MISSING_CRITICAL_FIELDS
  }

  return null
}

export { MOBILE_CONFIDENCE, MOBILE_REASON_CODE }
