"use client"

import { useNotification } from "@/app/(app)/context"
import { UploadButton } from "@/components/files/upload-button"
import { OrganizationSwitcher } from "@/components/organization/organization-switcher"
import { TenantBadge } from "@/components/organization/tenant-badge"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { TAX_WORKSPACE_ROUTE } from "@/components/tax/layout/content"
import { UserProfile } from "@/lib/auth"
import config from "@/lib/config"
import { useI18n } from "@/lib/i18n"
import type { AttentionSummary } from "@/lib/attention-contract"
import {
  ClockArrowUp,
  FileText,
  Gift,
  House,
  Import,
  Landmark,
  LayoutDashboard,
  Settings,
  Shield,
  Upload,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect } from "react"
import { ColoredText } from "../ui/colored-text"
import { Blinker } from "./blinker"
import { SidebarMenuItemWithHighlight } from "./sidebar-item"
import SidebarUser from "./sidebar-user"

export function AppSidebar({
  profile,
  currentOrganization,
  organizations,
  attention,
  unsortedFilesCount,
  isSelfHosted,
  canAccessOps,
}: {
  profile: UserProfile
  currentOrganization: {
    id: string
    name: string
    role: string
  }
  organizations: Array<{
    id: string
    name: string
    role: string
  }>
  attention: AttentionSummary
  unsortedFilesCount: number
  isSelfHosted: boolean
  canAccessOps: boolean
}) {
  const { open, setOpenMobile } = useSidebar()
  const pathname = usePathname()
  const { notification } = useNotification()
  const { t } = useI18n()
  const setupPendingCount = attention.readiness.steps.filter((step) => !step.complete).length
  const topItem = attention.topItem
  const transactionExceptionCount = attention.counts.transactionExceptions
  const taxAttentionCount = attention.counts.fiscalBlocked + attention.counts.fiscalNeedsReview

  const sidebarGuidance = topItem
    ? {
        title: topItem.title,
        description: topItem.description,
        href: topItem.href,
        actionLabel: topItem.nextActionLabel,
      }
    : attention.readiness.nextStep
      ? {
          title: "Completa la puesta en marcha",
          description: attention.readiness.nextStep.description,
          href: attention.readiness.nextStep.href,
          actionLabel: attention.readiness.nextStep.actionLabel,
        }
      : null

  // Hide sidebar on mobile when clicking an item
  useEffect(() => {
    setOpenMobile(false)
  }, [pathname, setOpenMobile])

  return (
    <>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader className="gap-3">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo/256.png" alt="Logo" className="h-10 w-10 rounded-lg" width={40} height={40} />
            <div className="grid flex-1 text-left leading-tight">
              <span className="truncate font-semibold text-lg">
                <ColoredText>{config.app.title}</ColoredText>
              </span>
              <TenantBadge organizationName={currentOrganization.name} role={currentOrganization.role} />
            </div>
          </Link>
          <OrganizationSwitcher currentOrganization={currentOrganization} organizations={organizations} expanded={open} />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <UploadButton className="w-full mt-4 mb-2">
              <Upload className="h-4 w-4" />
              {open ? <span>{t("unsorted.uploadNewFile")}</span> : ""}
            </UploadButton>
            {open && sidebarGuidance ? (
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <TenantBadge
                    compact
                    organizationName={attention.readiness.mode === "setup" ? "Puesta en marcha" : "Operación diaria"}
                    role={topItem?.state === "blocked" ? "Bloqueado" : "En foco"}
                  />
                  {setupPendingCount > 0 ? (
                    <span className="text-xs text-muted-foreground">{setupPendingCount} ajustes pendientes</span>
                  ) : null}
                </div>
                <p className="mt-3 text-sm font-medium">{sidebarGuidance.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{sidebarGuidance.description}</p>
                <Button asChild variant="outline" size="sm" className="mt-3 w-full justify-center">
                  <Link href={sidebarGuidance.href}>{sidebarGuidance.actionLabel}</Link>
                </Button>
              </div>
            ) : null}
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItemWithHighlight href="/dashboard">
                  <SidebarMenuButton asChild>
                    <Link href="/dashboard">
                      <House />
                      <span>{t("common.home")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItemWithHighlight>

                <SidebarMenuItemWithHighlight href="/transactions">
                  <SidebarMenuButton asChild>
                    <Link href="/transactions">
                      <FileText />
                      <span>{t("common.transactions")}</span>
                      {transactionExceptionCount > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-xs font-medium text-amber-900">
                          {transactionExceptionCount}
                        </span>
                      )}
                      {notification && notification.code === "sidebar.transactions" && notification.message && (
                        <Blinker />
                      )}
                      <span></span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItemWithHighlight>

                <SidebarMenuItemWithHighlight href="/unsorted">
                  <SidebarMenuButton asChild>
                    <Link href="/unsorted">
                      <ClockArrowUp />
                      <span>{t("common.unsorted")}</span>
                      {unsortedFilesCount > 0 && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                          {unsortedFilesCount}
                        </span>
                      )}
                      {notification && notification.code === "sidebar.unsorted" && notification.message && <Blinker />}
                      <span></span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItemWithHighlight>
                <SidebarMenuItemWithHighlight href={TAX_WORKSPACE_ROUTE}>
                  <SidebarMenuButton asChild>
                    <Link href={TAX_WORKSPACE_ROUTE}>
                      <Landmark />
                      <span>{t("common.tax")}</span>
                      {taxAttentionCount > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-xs font-medium text-amber-900">
                          {taxAttentionCount}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItemWithHighlight>
                <SidebarMenuItemWithHighlight href="/apps">
                  <SidebarMenuButton asChild>
                    <Link href="/apps">
                      <LayoutDashboard />
                      <span>{t("common.apps")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItemWithHighlight>
                <SidebarMenuItemWithHighlight href="/settings">
                  <SidebarMenuButton asChild>
                    <Link href="/settings">
                      <Settings />
                      <span>{t("common.settings")}</span>
                      {setupPendingCount > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                          {setupPendingCount}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItemWithHighlight>
                {canAccessOps ? (
                  <SidebarMenuItemWithHighlight href="/ops">
                    <SidebarMenuButton asChild>
                      <Link href="/ops">
                        <Shield />
                        <span>Ops</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItemWithHighlight>
                ) : null}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarRail />
        <SidebarFooter>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/import/csv">
                      <Import />
                      {t("common.importCsv")}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {isSelfHosted && config.links.donateUrl && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href={config.links.donateUrl} target="_blank">
                        <Gift />
                        {t("sidebar.thankAuthor")}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {!open && (
                  <SidebarMenuItem>
                    <SidebarTrigger />
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarUser profile={profile} isSelfHosted={isSelfHosted} />
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarFooter>
      </Sidebar>
    </>
  )
}
