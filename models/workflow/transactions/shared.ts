export function getFiscalPeriodStatusLabel(status: string | null) {
  if (status === "closed") {
    return "cerrado"
  }

  if (status === "presented") {
    return "presentado"
  }

  if (status === "ready") {
    return "listo"
  }

  if (status === "in_review") {
    return "en revisión"
  }

  if (status === "open") {
    return "abierto"
  }

  return "sin estado"
}

export function buildFiscalLockMessage(
  label: string,
  periods: Array<{ periodKey: string; status: string }>
) {
  if (periods.length === 0) {
    return null
  }

  const detail = periods
    .map((period) => `${period.periodKey} (${getFiscalPeriodStatusLabel(period.status)})`)
    .join(", ")
  return `${label} bloqueado por periodo fiscal: ${detail}.`
}
