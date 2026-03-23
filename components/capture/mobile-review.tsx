"use client"

import {
  getReasonLabel,
  getReviewEscalation,
  getReviewGuidance,
  isQuickReviewEligible,
  type MobileConfidence,
  type MobileReasonCode,
  type MobileReviewDraft,
  type MobileItemState,
} from "@/components/capture/mobile-contract"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { AlertTriangle, Loader2 } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { startTransition, useState } from "react"

interface MobileReviewProps {
  desktopUrl: string
  fileId: string
  filename: string
  initialDraft: MobileReviewDraft
  previewUrl: string
  confidence: MobileConfidence | null
  reasonCode: MobileReasonCode | null
  state: MobileItemState
  onAccept: (input: MobileReviewSubmitInput) => Promise<MobileReviewActionResult>
  onRetry: (fileId: string) => Promise<MobileReviewActionResult>
  onDefer: (fileId: string) => Promise<MobileReviewActionResult>
}

interface MobileReviewSubmitInput extends MobileReviewDraft {
  fileId: string
}

interface MobileReviewActionResult {
  success: boolean
  error?: string
}

const ACCEPT_LABEL = "Aceptar"
const EDIT_LABEL = "Corregir críticos"
const RETRY_LABEL = "Reintentar análisis"
const DESKTOP_LABEL = "Seguir en escritorio"

export function MobileReview({
  desktopUrl,
  fileId,
  filename,
  initialDraft,
  previewUrl,
  confidence,
  reasonCode,
  state,
  onAccept,
  onRetry,
  onDefer,
}: MobileReviewProps) {
  const router = useRouter()
  const [draft, setDraft] = useState(initialDraft)
  const [isEditingCriticals, setIsEditingCriticals] = useState(Boolean(reasonCode))
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState("")
  const quickReviewAllowed = isQuickReviewEligible({ state, reasonCode, confidence })
  const escalation = getReviewEscalation({ reasonCode, confidence, desktopUrl })
  const guidance = getReviewGuidance({ state, reasonCode, confidence })

  const missingCriticals = [
    draft.merchant,
    draft.issuedAt,
    draft.total,
    draft.currencyCode,
  ].some((value) => value.trim() === "")

  function updateDraft<K extends keyof MobileReviewDraft>(key: K, value: MobileReviewDraft[K]) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [key]: value,
    }))
  }

  async function runAction(action: () => Promise<MobileReviewActionResult>, nextHref?: string) {
    setError("")
    setIsPending(true)

    startTransition(async () => {
      const result = await action()
      setIsPending(false)

      if (!result.success) {
        setError(result.error || "No se ha podido completar la revisión.")
        return
      }

      if (nextHref) {
        router.push(nextHref)
        return
      }

      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {escalation ? (
        <Alert variant={escalation.tone === "destructive" ? "destructive" : "default"}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{getReasonLabel(reasonCode) || "Revisar en escritorio"}</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{escalation.reason}</p>
            <Button variant="outline" asChild>
              <Link href={escalation.desktopHref}>{DESKTOP_LABEL}</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Acción no completada</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!escalation ? (
        <Alert>
          <AlertTitle>{guidance.title}</AlertTitle>
          <AlertDescription>{guidance.description}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_1fr]">
        <Card className="relative overflow-hidden rounded-2xl">
          <Image
            src={previewUrl}
            alt={filename}
            width={680}
            height={900}
            sizes="(max-width: 1024px) 100vw, 340px"
            unoptimized
            className="aspect-[3/4] w-full object-cover"
          />
        </Card>

        <Card className="rounded-2xl p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{filename}</Badge>
            {reasonCode ? <Badge variant="secondary">{getReasonLabel(reasonCode)}</Badge> : null}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span>Proveedor</span>
              <Input
                value={draft.merchant}
                onChange={(event) => updateDraft("merchant", event.target.value)}
                readOnly={!isEditingCriticals}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>Fecha</span>
              <Input
                type="date"
                value={draft.issuedAt}
                onChange={(event) => updateDraft("issuedAt", event.target.value)}
                readOnly={!isEditingCriticals}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>Importe</span>
              <Input
                inputMode="decimal"
                value={draft.total}
                onChange={(event) => updateDraft("total", event.target.value)}
                readOnly={!isEditingCriticals}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>Moneda</span>
              <Input
                value={draft.currencyCode}
                onChange={(event) => updateDraft("currencyCode", event.target.value.toUpperCase())}
                readOnly={!isEditingCriticals}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>Nº factura</span>
              <Input
                value={draft.invoiceNumber}
                onChange={(event) => updateDraft("invoiceNumber", event.target.value)}
                readOnly={!isEditingCriticals}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>Categoría</span>
              <Input
                value={draft.categoryCode}
                onChange={(event) => updateDraft("categoryCode", event.target.value)}
                readOnly={!isEditingCriticals}
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={isPending || !quickReviewAllowed || missingCriticals}
              onClick={() =>
                void runAction(
                  () =>
                    onAccept({
                      fileId,
                      merchant: draft.merchant,
                      issuedAt: draft.issuedAt,
                      total: draft.total,
                      currencyCode: draft.currencyCode,
                      invoiceNumber: draft.invoiceNumber,
                      categoryCode: draft.categoryCode,
                    }),
                  "/capture/inbox"
                )
              }
            >
              {isPending ? <Loader2 className="animate-spin" /> : null}
              {ACCEPT_LABEL}
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setIsEditingCriticals(true)}
            >
              {EDIT_LABEL}
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => void runAction(() => onRetry(fileId), "/capture/inbox")}
            >
              {RETRY_LABEL}
            </Button>

            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() => void runAction(() => onDefer(fileId), desktopUrl)}
            >
              {DESKTOP_LABEL}
            </Button>
          </div>

          {missingCriticals && quickReviewAllowed ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Completa proveedor, fecha, importe y moneda para aceptar desde móvil.
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  )
}
