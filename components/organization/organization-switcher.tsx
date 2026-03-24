"use client"

import { switchOrganizationAction } from "@/app/(app)/settings/organization-actions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { Building2, Check, ChevronsUpDown } from "lucide-react"
import { usePathname } from "next/navigation"

type OrganizationOption = {
  id: string
  name: string
  role: string
}

type OrganizationSwitcherProps = {
  currentOrganization: OrganizationOption
  organizations: OrganizationOption[]
  expanded?: boolean
  variant?: "sidebar" | "mobile"
}

function formatRole(role: string) {
  switch (role) {
    case "owner":
      return "Owner"
    case "admin":
      return "Admin"
    case "member":
      return "Miembro"
    case "support_read_only":
      return "Soporte · lectura"
    case "support_read_write":
      return "Soporte · escritura"
    case "support":
      return "Soporte"
    default:
      return role
  }
}

export function OrganizationSwitcher({
  currentOrganization,
  organizations,
  expanded = true,
  variant = "sidebar",
}: OrganizationSwitcherProps) {
  const pathname = usePathname()
  const canSwitch = organizations.length > 1
  const compact = variant === "mobile" || !expanded

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 rounded-xl border border-slate-200 bg-white/85 text-slate-700 shadow-sm transition hover:bg-white",
            compact ? "h-10 min-w-0 px-2.5" : "w-full px-3 py-2 text-left",
            !canSwitch && "cursor-default"
          )}
          disabled={!canSwitch}
          aria-label="Cambiar de empresa"
        >
          <Building2 className="h-4 w-4 shrink-0 text-slate-500" />
          {compact ? (
            <span className="truncate text-sm font-medium">{currentOrganization.name}</span>
          ) : (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{currentOrganization.name}</p>
              <p className="truncate text-[11px] uppercase tracking-[0.08em] text-slate-500">
                {formatRole(currentOrganization.role)}
              </p>
            </div>
          )}
          {canSwitch ? <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" /> : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Cambiar de empresa</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations.map((organization) => {
          const isCurrent = organization.id === currentOrganization.id

          return (
            <form key={organization.id} action={switchOrganizationAction}>
              <input type="hidden" name="organizationId" value={organization.id} />
              <input type="hidden" name="returnTo" value={pathname} />
              <DropdownMenuItem asChild disabled={isCurrent}>
                <button type="submit" className="flex w-full items-center gap-2">
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate font-medium">{organization.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{formatRole(organization.role)}</p>
                  </div>
                  {isCurrent ? <Check className="h-4 w-4 text-primary" /> : null}
                </button>
              </DropdownMenuItem>
            </form>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
