import { BillingOverview } from "@/components/settings/billing-overview"
import { getCurrentUser } from "@/lib/auth"
import { formatBytes, formatNumber } from "@/lib/utils"
import { createPageMetadata } from "@/lib/i18n"
import { requireCurrentTenantProfile } from "@/lib/tenant"
import { getOrganizationBillingSummary } from "@/models/billing/summary"
import { listMembersByOrganizationId } from "@/models/memberships"

export const metadata = createPageMetadata("common.billing")

function formatDateLabel(value: Date | null | undefined) {
  if (!value) {
    return null
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value)
}

function formatStatusLabel(value: string) {
  switch (value) {
    case "trial":
      return "Prueba"
    case "active":
      return "Activo"
    case "past_due":
      return "Pendiente de cobro"
    case "cancelled":
      return "Cancelado"
    case "archived":
      return "Archivado"
    case "enabled":
      return "Acceso habilitado"
    case "grace_period":
      return "Periodo de gracia"
    case "restricted":
      return "Restringido"
    case "suspended":
      return "Suspendido"
    default:
      return value
  }
}

function formatLimit(metricKey: string, value: number) {
  if (value === -1) {
    return "Sin límite"
  }

  if (metricKey === "storage.bytes") {
    return formatBytes(value)
  }

  return formatNumber(value)
}

function hasStripeCustomer(contract: unknown) {
  return (
    typeof contract === "object"
    && contract !== null
    && "stripeCustomerId" in contract
    && typeof contract.stripeCustomerId === "string"
    && contract.stripeCustomerId.length > 0
  )
}

export default async function SettingsBillingPage() {
  const user = await getCurrentUser()
  const { organization } = await requireCurrentTenantProfile({
    getCurrentUser: async () => user,
  })

  const [summary, members] = await Promise.all([
    getOrganizationBillingSummary(organization.id),
    listMembersByOrganizationId(organization.id),
  ])
  const plan = summary.plan ?? {
    code: summary.access.plan.code,
    displayName: summary.access.plan.code,
    description: "Plan resuelto desde contrato sin definición local enriquecida.",
    benefits: [] as string[],
  }

  return (
    <BillingOverview
      accessStatusLabel={formatStatusLabel(summary.access.accessStatus)}
      addons={summary.addons.map((addon) => ({
        code: addon.code,
        name: addon.displayName,
        description: addon.description,
      }))}
      billingStatusLabel={formatStatusLabel(summary.access.billingStatus)}
      canOpenPortal={hasStripeCustomer(summary.contract)}
      currentPeriodEndsAtLabel={formatDateLabel(summary.access.currentPeriodEndsAt)}
      limits={[
        {
          key: "storage.bytes",
          label: "Almacenamiento",
          usageLabel: formatLimit("storage.bytes", summary.access.usage["storage.bytes"] ?? 0),
          limitLabel: formatLimit("storage.bytes", summary.access.limits["storage.bytes"] ?? 0),
        },
        {
          key: "ai.jobs.monthly",
          label: "Análisis IA / mes",
          usageLabel: formatLimit("ai.jobs.monthly", summary.access.usage["ai.jobs.monthly"] ?? 0),
          limitLabel: formatLimit("ai.jobs.monthly", summary.access.limits["ai.jobs.monthly"] ?? 0),
        },
        {
          key: "members.max",
          label: "Miembros",
          usageLabel: formatNumber(members.length),
          limitLabel: formatLimit("members.max", summary.access.limits["members.max"] ?? 0),
        },
      ]}
      plan={{
        code: plan.code,
        name: plan.displayName,
        description: plan.description,
        benefits: plan.benefits,
      }}
    />
  )
}
