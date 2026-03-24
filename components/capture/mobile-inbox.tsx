"use client"

import {
  buildDesktopUrl,
  getInboxGuidance,
  buildReviewUrl,
  getHumanStateLabel,
  getInboxPrimaryAction,
  getReasonLabel,
  getSystemStatusBanner,
  shouldShowDesktopShortcut,
  shouldPollInbox,
  type MobileInboxItem,
  type MobileSystemStatus,
} from "@/components/capture/mobile-contract"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AlertCircle, Loader2 } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"

interface MobileInboxProps {
  initialItems: MobileInboxItem[]
  initialSystemStatus: MobileSystemStatus
  openClientReviewRequestCount?: number
}

interface InboxResponse {
  items: MobileInboxItem[]
  systemStatus: MobileSystemStatus
}

const POLL_INTERVAL_MS = 2500

export function MobileInbox({
  initialItems,
  initialSystemStatus,
  openClientReviewRequestCount = 0,
}: MobileInboxProps) {
  const [items, setItems] = useState(initialItems)
  const [systemStatus, setSystemStatus] = useState(initialSystemStatus)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (!shouldPollInbox(items)) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void refreshInbox()
    }, POLL_INTERVAL_MS)

    return () => window.clearTimeout(timeoutId)
  }, [items])

  async function refreshInbox() {
    setIsRefreshing(true)

    try {
      const response = await fetch("/api/mobile/inbox", {
        cache: "no-store",
      })

      if (!response.ok) {
        return
      }

      const payload = (await response.json()) as InboxResponse
      setItems(payload.items || [])
      setSystemStatus(payload.systemStatus)
    } catch (error) {
      console.error("Mobile inbox refresh failed:", error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const banner = getSystemStatusBanner(systemStatus)

  return (
    <div className="space-y-4">
      {banner ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{banner.title}</AlertTitle>
          <AlertDescription>{banner.description}</AlertDescription>
        </Alert>
      ) : null}

      {openClientReviewRequestCount > 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Hay incidencias fiscales abiertas</AlertTitle>
          <AlertDescription>
            {openClientReviewRequestCount} incidencias siguen esperando documentación pendiente del cliente. Si subes
            aquí el documento que falta, después podrás terminar de resolverla en escritorio.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length > 0
            ? `${items.length} documentos pendientes en el canal móvil`
            : "No hay documentos pendientes en el canal móvil."}
        </p>
        <Button type="button" variant="ghost" size="sm" disabled={isRefreshing} onClick={() => void refreshInbox()}>
          {isRefreshing ? <Loader2 className="animate-spin" /> : null}
          Actualizar
        </Button>
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const desktopUrl = buildDesktopUrl(item.fileId)
          const guidance = getInboxGuidance(item)
          const primaryAction = getInboxPrimaryAction({
            fileId: item.fileId,
            reviewUrl: buildReviewUrl(item.fileId),
            desktopUrl,
            state: item.state,
          })
          const showDesktopShortcut = shouldShowDesktopShortcut(primaryAction, desktopUrl)

          return (
            <Card key={item.fileId} className="overflow-hidden rounded-2xl border-slate-200 bg-white/90">
              <div className="flex gap-3 p-3">
                <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                  <Image
                    src={item.previewUrl}
                    alt={item.filename}
                    fill
                    sizes="80px"
                    unoptimized
                    className="object-cover"
                  />
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{getHumanStateLabel(item.state)}</Badge>
                    {item.reasonCode ? <Badge variant="secondary">{getReasonLabel(item.reasonCode)}</Badge> : null}
                  </div>

                  <div>
                    <p className="truncate text-sm font-medium">{item.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      Actualizado {new Date(item.updatedAt).toLocaleString("es-ES")}
                    </p>
                  </div>

                  <div className="space-y-1 rounded-xl border bg-muted/20 p-2">
                    <p className="text-xs font-medium">{guidance.title}</p>
                    <p className="text-xs text-muted-foreground">{guidance.description}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {primaryAction.href ? (
                      <Button asChild size="sm">
                        <Link href={primaryAction.href}>{primaryAction.label}</Link>
                      </Button>
                    ) : (
                      <Button size="sm" disabled={primaryAction.disabled}>
                        {primaryAction.label}
                      </Button>
                    )}

                    {showDesktopShortcut ? (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={desktopUrl}>Escritorio</Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
