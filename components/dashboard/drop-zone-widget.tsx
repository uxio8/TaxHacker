"use client"

import { useNotification } from "@/app/(app)/context"
import { uploadFilesAction } from "@/app/(app)/files/actions"
import { FormError } from "@/components/forms/error"
import config from "@/lib/config"
import { useI18n } from "@/lib/i18n"
import { getUploadFlowState, resetFileInputValue } from "@/lib/upload-flow"
import { Camera, Loader2 } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { startTransition, useState } from "react"

export default function DashboardDropZoneWidget() {
  const router = useRouter()
  const pathname = usePathname()
  const { showNotification } = useNotification()
  const { t } = useI18n()
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget
    const files = input.files

    if (!files || files.length === 0) {
      resetFileInputValue(input)
      return
    }

    setIsUploading(true)
    setUploadError("")
    const formData = new FormData()

    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i])
    }

    startTransition(async () => {
      try {
        const result = await uploadFilesAction(formData)
        if (result.success) {
          const uploadFlow = getUploadFlowState({
            currentPath: pathname,
            destination: "unsorted",
          })

          showNotification({ code: uploadFlow.notificationCode, message: "new" })
          setTimeout(() => showNotification({ code: uploadFlow.notificationCode, message: "" }), 3000)

          if (uploadFlow.redirectPath) {
            router.push(uploadFlow.redirectPath)
          }

          if (uploadFlow.redirectPath || uploadFlow.shouldRefresh) {
            router.refresh()
          }
        } else {
          setUploadError(result.error ? result.error : t("common.errors.generic"))
        }
      } finally {
        resetFileInputValue(input)
        setIsUploading(false)
      }
    })
  }

  return (
    <div className="flex w-full h-full">
      <label className="relative w-full h-full border-2 border-dashed rounded-lg transition-colors hover:border-primary cursor-pointer">
        <input
          type="file"
          id="fileInput"
          className="hidden"
          multiple
          accept={config.upload.acceptedMimeTypes}
          onChange={handleFileChange}
        />
        <div className="flex flex-col items-center justify-center gap-4 p-8 text-center h-full">
          {isUploading ? (
            <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
          ) : (
            <Camera className="h-8 w-8 text-muted-foreground" />
          )}
          <div>
            <p className="text-lg font-medium">
              {isUploading ? t("dashboard.dropzone.loading") : t("dashboard.dropzone.title")}
            </p>
            {!uploadError && (
              <p className="text-sm text-muted-foreground">{t("dashboard.dropzone.hint")}</p>
            )}
            {uploadError && <FormError>{uploadError}</FormError>}
          </div>
        </div>
      </label>
    </div>
  )
}
