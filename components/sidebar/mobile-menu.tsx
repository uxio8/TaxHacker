"use client"

import { OrganizationSwitcher } from "@/components/organization/organization-switcher"
import { TAX_WORKSPACE_ROUTE } from "@/components/tax/layout/content"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useSidebar } from "@/components/ui/sidebar"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { AttentionSummary } from "@/lib/attention-contract"
import config from "@/lib/config"
import Link from "next/link"
import { usePathname } from "next/navigation"

export default function MobileMenu({
  unsortedFilesCount,
  currentOrganization,
  organizations,
  attention,
  canAccessOps,
}: {
  unsortedFilesCount: number
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
  canAccessOps: boolean
}) {
  const { toggleSidebar } = useSidebar()
  const pathname = usePathname()
  const { t } = useI18n()
  const isTaxRoute = pathname.startsWith(TAX_WORKSPACE_ROUTE)
  const isCaptureRoute = pathname === "/capture"
  const isInboxRoute = pathname.startsWith("/capture/inbox")
  const setupPendingCount = attention.readiness.steps.filter((step) => !step.complete).length
  const navAction = attention.topItem
    ? {
        href: attention.topItem.href,
        label: attention.topItem.nextActionLabel,
        description: attention.topItem.title,
      }
    : attention.readiness.nextStep
      ? {
          href: attention.readiness.nextStep.href,
          label: attention.readiness.nextStep.actionLabel,
          description: "Completa la puesta en marcha",
        }
      : null

  return (
    <menu className="fixed top-0 left-0 z-50 w-full border-b border-slate-200 bg-background/95 backdrop-blur md:hidden">
      <div className="flex [@media(display-mode:standalone)]:hidden items-center justify-between gap-2 border-b-2 p-2">
        <Avatar className="h-10 w-10 cursor-pointer rounded-lg" onClick={toggleSidebar}>
          <AvatarImage src="/logo/256.png" />
          <AvatarFallback className="rounded-lg">AI</AvatarFallback>
        </Avatar>

        <div className="flex min-w-0 items-center gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <Link href="/" className="text-lg font-bold">
              {config.app.title}
            </Link>
            <OrganizationSwitcher
              currentOrganization={currentOrganization}
              organizations={organizations}
              variant="mobile"
            />
          </div>
          <Link
            href="/capture"
            className={cn(
              "rounded-md border px-2 py-1 text-xs font-medium",
              pathname.startsWith("/capture")
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground"
            )}
          >
            {t("common.capture")}
          </Link>
          <Link
            href={TAX_WORKSPACE_ROUTE}
            className={cn(
              "rounded-md border px-2 py-1 text-xs font-medium",
              isTaxRoute ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground"
            )}
          >
            {t("common.tax")}
          </Link>
          {canAccessOps ? (
            <Link
              href="/ops"
              className={cn(
                "rounded-md border px-2 py-1 text-xs font-medium",
                pathname.startsWith("/ops")
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              )}
            >
              Ops
            </Link>
          ) : null}
        </div>

        <Link
          href="/unsorted"
          className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground"
        >
          {unsortedFilesCount}
        </Link>
      </div>

      <div className="hidden [@media(display-mode:standalone)]:flex items-center gap-2 px-3 py-2 shadow-sm">
        <Avatar className="h-9 w-9 rounded-lg">
          <AvatarImage src="/logo/256.png" />
          <AvatarFallback className="rounded-lg">AI</AvatarFallback>
        </Avatar>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <span className="sr-only">{config.app.title}</span>
          <Link
            href="/capture"
            aria-current={isCaptureRoute ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium",
              isCaptureRoute
                ? "border-primary bg-primary text-primary-foreground"
                : "border-slate-200 bg-white text-muted-foreground"
            )}
          >
            {t("common.capture")}
          </Link>
          <Link
            href="/capture/inbox"
            aria-current={isInboxRoute ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium",
              isInboxRoute
                ? "border-primary bg-primary text-primary-foreground"
                : "border-slate-200 bg-white text-muted-foreground"
            )}
          >
            {t("capture.inbox.title")}
          </Link>
        </div>
      </div>

      {navAction ? (
        <Link href={navAction.href} className="flex items-center justify-between gap-3 border-t px-3 py-2 text-xs">
          <div className="min-w-0">
            <p className="truncate font-medium">{navAction.description}</p>
            <p className="truncate text-muted-foreground">{navAction.label}</p>
          </div>
          <span
            className={cn(
              "rounded-full border px-2 py-1 font-medium",
              attention.readiness.mode === "setup"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-slate-200 text-muted-foreground"
            )}
          >
            {attention.readiness.mode === "setup"
              ? `Setup ${setupPendingCount > 0 ? `(${setupPendingCount})` : ""}`
              : "En foco"}
          </span>
        </Link>
      ) : null}
    </menu>
  )
}
