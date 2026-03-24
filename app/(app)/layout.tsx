import { SubscriptionExpired } from "@/components/auth/subscription-expired"
import ScreenDropArea from "@/components/files/screen-drop-area"
import { ImpersonationBanner } from "@/components/ops/impersonation-banner"
import MobileMenu from "@/components/sidebar/mobile-menu"
import { AppSidebar } from "@/components/sidebar/sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { getCurrentImpersonation, getCurrentUser, isSubscriptionExpired } from "@/lib/auth"
import config from "@/lib/config"
import { requireCurrentTenantProfile } from "@/lib/tenant"
import { getCurrentOrganizationUserBillingProjection } from "@/models/billing/access"
import { buildSidebarUserProfile } from "@/models/billing/runtime"
import { getNavigationAttentionSummary } from "@/models/attention"
import { getUnsortedFilesCount } from "@/models/files"
import { listOrganizationsForUser } from "@/models/organizations"
import { canAccessPlatformOps } from "@/models/platform-admins"
import type { Metadata, Viewport } from "next"
import "../globals.css"
import { NotificationProvider } from "./context"

export const metadata: Metadata = {
  applicationName: config.app.title,
  title: {
    template: `%s | ${config.app.title}`,
    default: config.app.title,
  },
  description: config.app.description,
  icons: {
    icon: [
      { url: "/favicon.ico" },
      {
        url: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    shortcut: "/favicon.ico",
    apple: [
      {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  manifest: "/manifest.webmanifest",
}

export const viewport: Viewport = {
  themeColor: "#ffffff",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  const { organization: currentOrganization, membership: currentMembership } = await requireCurrentTenantProfile({
    getCurrentUser: async () => user,
  })
  const [unsortedFilesCount, attention, organizations, canAccessOps, billingProjection, impersonation] = await Promise.all([
    getUnsortedFilesCount(currentOrganization.id),
    getNavigationAttentionSummary({
      organizationId: currentOrganization.id,
      organizationName: currentOrganization.name,
      userId: user.id,
      businessAddress: user.businessAddress,
    }),
    listOrganizationsForUser(user.id),
    canAccessPlatformOps(user.id),
    getCurrentOrganizationUserBillingProjection(currentOrganization.id),
    getCurrentImpersonation(),
  ])

  const userProfile = buildSidebarUserProfile(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar ? `${user.avatar}?${user.id}` : undefined,
    },
    billingProjection
  )

  return (
    <NotificationProvider>
      <ScreenDropArea>
        <SidebarProvider key={currentOrganization.id}>
          <MobileMenu
            unsortedFilesCount={unsortedFilesCount}
            currentOrganization={{
              id: currentOrganization.id,
              name: currentOrganization.name,
              role: currentMembership.role,
            }}
            organizations={impersonation ? [organizations.find((organization) => organization.id === currentOrganization.id) ?? {
              id: currentOrganization.id,
              name: currentOrganization.name,
              role: currentMembership.role,
            }] : organizations}
            attention={attention}
            canAccessOps={canAccessOps}
          />
          <AppSidebar
            profile={userProfile}
            currentOrganization={{
              id: currentOrganization.id,
              name: currentOrganization.name,
              role: currentMembership.role,
            }}
            organizations={impersonation ? [organizations.find((organization) => organization.id === currentOrganization.id) ?? {
              id: currentOrganization.id,
              name: currentOrganization.name,
              role: currentMembership.role,
            }] : organizations}
            attention={attention}
            unsortedFilesCount={unsortedFilesCount}
            isSelfHosted={config.selfHosted.isEnabled}
            canAccessOps={canAccessOps}
          />
          <SidebarInset className="w-full h-full mt-[60px] md:mt-0 overflow-auto">
            {impersonation ? (
              <ImpersonationBanner
                actorLabel={impersonation.actorUser.name || impersonation.actorUser.email}
                effectiveUserLabel={impersonation.effectiveUser.name || impersonation.effectiveUser.email}
                organizationName={currentOrganization.name}
                mode={impersonation.session.mode}
              />
            ) : null}
            {isSubscriptionExpired(billingProjection) && <SubscriptionExpired />}
            {children}
          </SidebarInset>
        </SidebarProvider>
        <Toaster />
      </ScreenDropArea>
    </NotificationProvider>
  )
}

export const dynamic = "force-dynamic"
