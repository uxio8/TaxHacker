"use client"

import { useNotification } from "@/app/(app)/context"
import { Button } from "@/components/ui/button"
import config from "@/lib/config"
import { useI18n } from "@/lib/i18n"
import { notifyUploadSuccess, resetFileInputValue, uploadFilesWithHttp } from "@/lib/upload-flow"
import { Loader2 } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { ComponentProps, startTransition, useRef, useState } from "react"
import { FormError } from "../forms/error"

export function UploadButton({ children, ...props }: { children: React.ReactNode } & ComponentProps<typeof Button>) {
  const router = useRouter()
  const pathname = usePathname()
  const { showNotification } = useNotification()
  const { t } = useI18n()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadError, setUploadError] = useState("")
  const [isUploading, setIsUploading] = useState(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget
    const files = input.files

    if (!files || files.length === 0) {
      resetFileInputValue(input)
      return
    }

    setUploadError("")
    setIsUploading(true)

    startTransition(async () => {
      try {
        const result = await uploadFilesWithHttp({ files })
        if (result.success) {
          notifyUploadSuccess({
            currentPath: pathname,
            destination: "unsorted",
            router,
            showNotification,
          })
        } else {
          setUploadError(result.error ? result.error : t("common.errors.generic"))
        }
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : t("common.errors.generic"))
      } finally {
        resetFileInputValue(input)
        setIsUploading(false)
      }
    })
  }

  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault() // Prevent any form submission
    fileInputRef.current?.click()
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept={config.upload.acceptedMimeTypes}
        onChange={handleFileChange}
      />

      <Button onClick={handleButtonClick} disabled={isUploading} type="button" {...props}>
        {isUploading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("files.upload.uploading")}
          </>
        ) : (
          <>{children}</>
        )}
      </Button>

      {uploadError && <FormError>{uploadError}</FormError>}
    </div>
  )
}
