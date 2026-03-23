import type { Counterparty, FiscalProfile } from "../../prisma/client/index.js"

type GateProfile = Pick<FiscalProfile, "organizationId" | "issuesInvoices">
type GateCounterparty = Pick<Counterparty, "isActive" | "taxIdNormalized">

export type Model347GateStatus = "ready" | "blocked_counterparty_quality"

export type Model347Gate = {
  obligationCode: "347"
  fiscalYear: number
  periodKey: string
  status: Model347GateStatus
  visible: boolean
  blockingReasons: string[]
  quality: {
    activeCounterpartyCount: number
    withTaxIdCount: number
    missingTaxIdCount: number
  }
}

function hasUsableTaxId(counterparty: GateCounterparty) {
  return Boolean(counterparty.taxIdNormalized && counterparty.taxIdNormalized !== "none")
}

function summarizeCounterpartyQuality(counterparties: GateCounterparty[]) {
  const activeCounterparties = counterparties.filter((counterparty) => counterparty.isActive)
  const withTaxIdCount = activeCounterparties.filter(hasUsableTaxId).length

  return {
    activeCounterpartyCount: activeCounterparties.length,
    withTaxIdCount,
    missingTaxIdCount: activeCounterparties.length - withTaxIdCount,
  }
}

export function getModel347Gate(input: {
  fiscalYear: number
  profile: GateProfile
  counterparties: GateCounterparty[]
}): Model347Gate {
  const quality = summarizeCounterpartyQuality(input.counterparties)
  const blockingReasons: string[] = []

  if (quality.activeCounterpartyCount === 0) {
    blockingReasons.push(
      "No hay terceros activos consolidados. Completa la agenda de contrapartes antes de preparar el modelo 347."
    )
  } else if (quality.missingTaxIdCount > 0) {
    blockingReasons.push(
      "Hay terceros activos sin NIF consolidado. Completa la resolucion de contraparte antes de preparar el modelo 347."
    )
  }

  return {
    obligationCode: "347",
    fiscalYear: input.fiscalYear,
    periodKey: `${input.fiscalYear}-Y`,
    status: blockingReasons.length > 0 ? "blocked_counterparty_quality" : "ready",
    visible: blockingReasons.length === 0,
    blockingReasons,
    quality,
  }
}
