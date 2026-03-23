import ProfileSettingsForm from "@/components/settings/profile-settings-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import { createPageMetadata } from "@/lib/i18n"
import { requireCurrentTenantProfile } from "@/lib/tenant"
import { getCurrentOrganizationUserBillingProjection } from "@/models/billing/access"
import Link from "next/link"

export const metadata = createPageMetadata("settings.profileAndPlan")

export default async function ProfileSettingsPage() {
  const user = await getCurrentUser()
  const { organization } = await requireCurrentTenantProfile({
    getCurrentUser: async () => user,
  })
  const billingProjection = await getCurrentOrganizationUserBillingProjection(organization.id)

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Accesos de organización</CardTitle>
          <CardDescription>
            La facturación y el equipo ya se gestionan por empresa desde sus apartados dedicados.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/settings/members">Ver miembros</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/settings/billing">Ver billing</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="w-full">
        <ProfileSettingsForm user={user} billing={billingProjection} />
      </div>
    </div>
  )
}
