import { OrganizationDetailShell } from "@/components/ops/organization-detail-shell"
import { createPageMetadata } from "@/lib/i18n"
import { getOpsOrganizationDetail } from "@/models/ops-organization-detail"
import { notFound } from "next/navigation"

export const metadata = createPageMetadata("common.settings")

export default async function OpsOrganizationDetailPage({
  params,
}: {
  params: Promise<{ organizationId: string }>
}) {
  const { organizationId } = await params
  const detail = await getOpsOrganizationDetail(organizationId)

  if (!detail) {
    notFound()
  }

  return <OrganizationDetailShell detail={detail} />
}
