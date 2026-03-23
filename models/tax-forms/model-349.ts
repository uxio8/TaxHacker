import type { Counterparty, FiscalProfile } from "../../prisma/client/index.js"

type GateProfile = Pick<FiscalProfile, "organizationId" | "hasIntraEuOperations">
type GateCounterparty = Pick<Counterparty, "isActive" | "taxIdNormalized">

export type Model349GateStatus = "ready" | "blocked_profile" | "blocked_counterparty_quality"

export type Model349Gate = {
  obligationCode: "349"
  fiscalYear: number
  periodKey: string
  status: Model349GateStatus
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

export function getModel349Gate(input: {
  fiscalYear: number
  profile: GateProfile
  counterparties: GateCounterparty[]
}): Model349Gate {
  const quality = summarizeCounterpartyQuality(input.counterparties)
  const blockingReasons: string[] = []

  if (!input.profile.hasIntraEuOperations) {
    blockingReasons.push(
      "El perfil fiscal no declara operaciones intracomunitarias. Activalas antes de abrir el modelo 349."
    )
  } else if (quality.activeCounterpartyCount === 0) {
    blockingReasons.push(
      "No hay terceros activos consolidados para contrastar el modelo 349. Revisa contrapartes antes de continuar."
    )
  } else if (quality.missingTaxIdCount > 0) {
    blockingReasons.push(
      "Hay terceros activos sin NIF/VAT consolidado. Completa la resolucion de contraparte antes de preparar el modelo 349."
    )
  }

  return {
    obligationCode: "349",
    fiscalYear: input.fiscalYear,
    periodKey: `${input.fiscalYear}-Y`,
    status: !input.profile.hasIntraEuOperations
      ? "blocked_profile"
      : blockingReasons.length > 0
        ? "blocked_counterparty_quality"
        : "ready",
    visible: blockingReasons.length === 0,
    blockingReasons,
    quality,
  }
}
