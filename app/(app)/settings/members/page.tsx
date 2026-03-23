import { MembersManagement } from "@/components/settings/members-management"
import { createPageMetadata } from "@/lib/i18n"
import { getCurrentUser } from "@/lib/auth"
import { isTenantAdminRole, requireCurrentTenantProfile } from "@/lib/tenant"
import { getOrganizationAccess } from "@/models/billing/access"
import { listOrganizationInvitations } from "@/models/invitations"
import { listMembersByOrganizationId } from "@/models/memberships"

export const metadata = createPageMetadata("common.settings")

function formatDateLabel(value: Date | null) {
  if (!value) {
    return "sin fecha"
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value)
}

function formatMemberLimit(limit: number) {
  if (limit === -1) {
    return "sin límite"
  }

  return String(limit)
}

export default async function SettingsMembersPage() {
  const user = await getCurrentUser()
  const { organization, membership } = await requireCurrentTenantProfile({
    getCurrentUser: async () => user,
  })

  const [members, invitations, access] = await Promise.all([
    listMembersByOrganizationId(organization.id),
    listOrganizationInvitations(organization.id),
    getOrganizationAccess(organization.id),
  ])

  return (
    <MembersManagement
      canManageMembers={isTenantAdminRole(membership.role)}
      memberLimitLabel={formatMemberLimit(access.limits["members.max"] ?? 0)}
      members={members.map((member) => ({
        id: member.id,
        userId: member.userId,
        name: member.user?.name ?? null,
        email: member.user?.email ?? null,
        role: member.role,
        isCurrentUser: member.userId === user.id,
      }))}
      invitations={invitations.map((invitation) => ({
        id: invitation.id,
        email: invitation.email ?? invitation.emailNormalized,
        role: invitation.role,
        token: invitation.token,
        status: invitation.revokedAt ? "revoked" : invitation.acceptedAt ? "accepted" : "pending",
        expiresAtLabel: formatDateLabel(invitation.expiresAt),
      }))}
    />
  )
}
