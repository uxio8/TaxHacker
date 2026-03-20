"use client"

import { useNotification } from "@/app/(app)/context"
import { uploadFilesAction } from "@/app/(app)/files/actions"
import { Button } from "@/components/ui/button"
import config from "@/lib/config"
import { getUploadFlowState, resetFileInputValue } from "@/lib/upload-flow"
import { Loader2 } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { ComponentProps, startTransition, useRef, useState } from "react"
import { FormError } from "../forms/error"

export function UploadButton({ children, ...props }: { children: React.ReactNode } & ComponentProps<typeof Button>) {
  const router = useRouter()
  const pathname = usePathname()
  const { showNotification } = useNotification()
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
          setUploadError(result.error ? result.error : "Something went wrong...")
        }
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
        id="fileInput"
        className="hidden"
        multiple
        accept={config.upload.acceptedMimeTypes}
        onChange={handleFileChange}
      />

      <Button onClick={handleButtonClick} disabled={isUploading} type="button" {...props}>
        {isUploading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Uploading...
          </>
        ) : (
          <>{children}</>
        )}
      </Button>

      {uploadError && <FormError>{uploadError}</FormError>}
    </div>
  )
}
