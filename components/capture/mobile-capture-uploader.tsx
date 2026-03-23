"use client"

import { MOBILE_ITEM_STATE, type MobileItemState } from "@/components/capture/mobile-contract"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useI18n, type MessageKey } from "@/lib/i18n"
import { Camera, FileUp, Loader2, UploadCloud } from "lucide-react"
import Link from "next/link"
import { useRef, useState } from "react"

interface CaptureResultItem {
  fileId: string
  state: MobileItemState
  reasonCode: string | null
  confidence: string | null
  inboxUrl?: string | null
  reviewUrl?: string | null
}

interface CaptureResponse {
  items?: CaptureResultItem[]
  error?: string
}

const MOBILE_CAPTURE_STATE_MESSAGE_KEYS: Record<MobileItemState, MessageKey> = {
  [MOBILE_ITEM_STATE.ANALYZING]: "capture.uploader.state.analyzing",
  [MOBILE_ITEM_STATE.READY_FOR_REVIEW]: "capture.uploader.state.readyForReview",
  [MOBILE_ITEM_STATE.DEFERRED_TO_DESKTOP]: "capture.uploader.state.deferredToDesktop",
  [MOBILE_ITEM_STATE.ERROR]: "capture.uploader.state.error",
}

export function MobileCaptureUploader() {
  const { t } = useI18n()
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<CaptureResultItem | null>(null)
  const humanState = result ? t(MOBILE_CAPTURE_STATE_MESSAGE_KEYS[result.state]) : t("capture.uploader.state.error")

  async function submitFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return
    }

    setIsUploading(true)
    setError("")

    const formData = new FormData()

    for (const file of Array.from(fileList)) {
      formData.append("files", file)
    }

    try {
      const response = await fetch("/api/mobile/capture", {
        method: "POST",
        body: formData,
      })
      const payload = (await response.json()) as CaptureResponse

      if (!response.ok) {
        setError(payload.error || t("capture.uploader.uploadError"))
        return
      }

      setResult(payload.items?.[0] || null)
    } catch (uploadError) {
      console.error("Mobile capture upload failed:", uploadError)
      setError(t("capture.uploader.uploadError"))
    } finally {
      setIsUploading(false)

      if (cameraInputRef.current) {
        cameraInputRef.current.value = ""
      }

      if (uploadInputRef.current) {
        uploadInputRef.current.value = ""
      }
    }
  }

  return (
    <div className="space-y-4 [@media(display-mode:standalone)]:space-y-3">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => void submitFiles(event.target.files)}
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(event) => void submitFiles(event.target.files)}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          size="lg"
          className="h-20 rounded-2xl text-base [@media(display-mode:standalone)]:h-16"
          disabled={isUploading}
          onClick={() => cameraInputRef.current?.click()}
        >
          {isUploading ? <Loader2 className="animate-spin" /> : <Camera />}
          {t("capture.uploader.takePhoto")}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="h-20 rounded-2xl border-dashed text-base [@media(display-mode:standalone)]:h-16"
          disabled={isUploading}
          onClick={() => uploadInputRef.current?.click()}
        >
          {isUploading ? <Loader2 className="animate-spin" /> : <FileUp />}
          {t("capture.uploader.uploadFile")}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">{t("capture.uploader.description")}</p>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{t("capture.uploader.errorTitle")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {result ? (
        <Card className="rounded-2xl border-emerald-200 bg-emerald-50/80 p-4 [@media(display-mode:standalone)]:p-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-emerald-900">{t("capture.uploader.resultTitle")}</p>
              <p className="text-sm text-emerald-800">{t("capture.uploader.resultDescription", { state: humanState })}</p>
            </div>
            <UploadCloud className="mt-1 h-5 w-5 text-emerald-700" />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild>
              <Link href={result.inboxUrl || "/capture/inbox"}>{t("capture.uploader.openInbox")}</Link>
            </Button>
            {result.reviewUrl ? (
              <Button variant="outline" asChild>
                <Link href={result.reviewUrl}>{t("capture.uploader.openReview")}</Link>
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}
    </div>
  )
}
