import { buildAnnualHandoffPack } from "../../fiscal/annual-handoff.ts"
import { getCounterparties } from "../../fiscal/counterparties.ts"
import type { FiscalObligationDetail } from "../../fiscal/obligations.ts"
import { getModel347Gate } from "../../tax-forms/model-347.ts"
import { getModel349Gate } from "../../tax-forms/model-349.ts"
import {
  buildAnnualNextAction,
  buildAnnualOperationalNote,
  findAnnualObligation,
  getAnnualResponsibleLabel,
  getStatusLabel,
  getStatusVariant,
  normalizeFiscalOwner,
  normalizeFiscalStatus,
  resolveAnnualDueDateLabel,
} from "./shared.ts"
import type { AnnualCockpitCode, TaxWorkflowAnnualOverview, TaxWorkflowProfile } from "./types.ts"

export function buildAnnualOverview(input: {
  fiscalYear: number
  profile: TaxWorkflowProfile
  obligations: FiscalObligationDetail[]
  counterparties: Awaited<ReturnType<typeof getCounterparties>>
}): TaxWorkflowAnnualOverview {
  const items: TaxWorkflowAnnualOverview["items"] = []
  const pushAnnualItem = (inputItem: {
    code: AnnualCockpitCode
    title: string
    description: string
    obligation: FiscalObligationDetail | null
  }) => {
    const status = normalizeFiscalStatus(inputItem.obligation?.status) ?? "waiting_on_documents"
    const nextAction = buildAnnualNextAction(status, inputItem.code, input.fiscalYear)

    items.push({
      code: inputItem.code,
      title: inputItem.title,
      description: inputItem.description,
      href: `/tax/forms/${inputItem.code}?period=${input.fiscalYear}-Y`,
      dueDateLabel: resolveAnnualDueDateLabel(inputItem.code, input.fiscalYear, inputItem.obligation),
      statusLabel: getStatusLabel(status),
      statusVariant: getStatusVariant(status),
      responsibleLabel: getAnnualResponsibleLabel(status, normalizeFiscalOwner(inputItem.obligation?.owner)),
      nextActionLabel: nextAction.label,
      nextActionHref: nextAction.href,
      operationalNote: buildAnnualOperationalNote(status, inputItem.obligation),
    })
  }

  if (input.profile.hasRentWithholding) {
    pushAnnualItem({
      code: "180",
      title: "Modelo 180",
      description: "Resumen anual de alquileres con retención a partir del mismo núcleo que usa el 115.",
      obligation: findAnnualObligation(input.obligations, "180", input.fiscalYear),
    })
  }

  pushAnnualItem({
    code: "390",
    title: "Modelo 390",
    description: "Resumen anual de IVA consolidado desde el núcleo ya validado del 303.",
    obligation: findAnnualObligation(input.obligations, "390", input.fiscalYear),
  })

  const gate347 = getModel347Gate({
    fiscalYear: input.fiscalYear,
    profile: input.profile,
    counterparties: input.counterparties,
  })

  if (gate347.visible) {
    pushAnnualItem({
      code: "347",
      title: "Modelo 347",
      description: "Operaciones con terceros habilitadas porque la calidad de contrapartes ya es suficiente.",
      obligation: findAnnualObligation(input.obligations, "347", input.fiscalYear),
    })
  }

  const gate349 = getModel349Gate({
    fiscalYear: input.fiscalYear,
    profile: input.profile,
    counterparties: input.counterparties,
  })

  if (gate349.visible) {
    pushAnnualItem({
      code: "349",
      title: "Modelo 349",
      description: "Operaciones intracomunitarias activas con gate abierto por perfil fiscal y terceros.",
      obligation: findAnnualObligation(input.obligations, "349", input.fiscalYear),
    })
  }

  const annualHandoff = buildAnnualHandoffPack({
    fiscalYear: input.fiscalYear,
    profile: {
      annualCloseMonth: input.profile.annualCloseMonth,
      companyName: input.profile.companyName,
      organizationId: input.profile.organizationId,
      taxId: input.profile.taxId,
    },
    obligations: input.obligations.filter((obligation) => obligation.fiscalYear === input.fiscalYear),
  })

  return {
    fiscalYear: input.fiscalYear,
    items,
    handoffHref: "/tax/archive/annual",
    handoffSummary: `${annualHandoff.summary.readyOrFiledItems}/${annualHandoff.summary.totalItems} ítems listos o presentados, ${annualHandoff.summary.blockedItems} con bloqueos.`,
  }
}
