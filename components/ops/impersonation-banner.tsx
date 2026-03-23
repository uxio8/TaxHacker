import { stopImpersonationAction } from "@/app/(app)/ops/actions"
import { Button } from "@/components/ui/button"

type ImpersonationBannerProps = {
  actorLabel: string
  effectiveUserLabel: string
  organizationName: string
  mode: "read_only" | "read_write"
}

export function ImpersonationBanner({
  actorLabel,
  effectiveUserLabel,
  organizationName,
  mode,
}: ImpersonationBannerProps) {
  return (
    <div className="border-b border-amber-200 bg-amber-50/90 px-4 py-3 text-amber-950">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold">Sesión de impersonación activa</p>
          <p className="text-sm">
            Estás actuando como <span className="font-medium">{effectiveUserLabel}</span> en{" "}
            <span className="font-medium">{organizationName}</span> · modo{" "}
            <span className="font-medium">{mode === "read_write" ? "escritura" : "lectura"}</span>
          </p>
          <p className="text-xs text-amber-800">Actor real: {actorLabel}</p>
        </div>
        <form action={stopImpersonationAction}>
          <input type="hidden" name="returnTo" value="/ops" />
          <Button type="submit" size="sm" variant="outline" className="border-amber-300 bg-white text-amber-950">
            Salir de la impersonación
          </Button>
        </form>
      </div>
    </div>
  )
}
