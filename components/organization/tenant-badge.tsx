"use client"

import { cn } from "@/lib/utils"

type TenantBadgeProps = {
  organizationName: string
  role: string
  compact?: boolean
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

export function TenantBadge({ organizationName, role, compact = false }: TenantBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-slate-700",
        compact ? "text-[11px]" : "text-xs"
      )}
    >
      <span className="truncate font-medium">{organizationName}</span>
      <span className="text-slate-400">·</span>
      <span className="shrink-0 uppercase tracking-[0.08em] text-slate-500">{formatRole(role)}</span>
    </div>
  )
}
