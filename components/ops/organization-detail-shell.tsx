import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { OrganizationAuditCard } from "./organization-audit-card"
import { OrganizationContractCard } from "./organization-contract-card"
import { OrganizationHealthCard } from "./organization-health-card"
import { OrganizationMembersCard } from "./organization-members-card"
import { OrganizationSupportCard } from "./organization-support-card"
import type { getOpsOrganizationDetail } from "@/models/ops-organization-detail"

type OrganizationDetail = NonNullable<Awaited<ReturnType<typeof getOpsOrganizationDetail>>>

type OrganizationDetailShellProps = {
  detail: OrganizationDetail
}

function formatDateLabel(value: Date) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value)
}

export function OrganizationDetailShell({ detail }: OrganizationDetailShellProps) {
  const effectiveAccessStatus = detail.contract?.accessStatus ?? "enabled"

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Empresa</Badge>
            <Badge>{detail.contract?.planCode ?? "sin contrato"}</Badge>
            <Badge variant="secondary">{effectiveAccessStatus}</Badge>
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{detail.organization.name}</h1>
            <p className="text-sm text-muted-foreground">Alta {formatDateLabel(detail.organization.createdAt)}</p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href="/ops">Volver a Ops</Link>
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <OrganizationContractCard
          organizationId={detail.organization.id}
          contract={detail.contract}
          effectiveAccessStatus={effectiveAccessStatus}
        />
        <OrganizationHealthCard health={detail.health} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <OrganizationMembersCard
          organizationId={detail.organization.id}
          members={detail.members}
          invitations={detail.invitations}
        />
        <OrganizationSupportCard
          organizationId={detail.organization.id}
          members={detail.members}
          support={detail.support}
        />
      </div>

      <OrganizationAuditCard
        recentLogs={detail.audit.recentLogs}
        recentBillingEvents={detail.audit.recentBillingEvents}
      />
    </div>
  )
}
