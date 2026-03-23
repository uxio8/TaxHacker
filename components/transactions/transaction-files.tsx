"use client"

import { useNotification } from "@/app/(app)/context"
import { deleteTransactionFileAction } from "@/app/(app)/transactions/actions"
import { FormError } from "@/components/forms/error"
import { FilePreview } from "@/components/files/preview"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import config from "@/lib/config"
import { useI18n } from "@/lib/i18n"
import { notifyUploadSuccess, resetFileInputValue, uploadFilesWithHttp } from "@/lib/upload-flow"
import { File, Transaction } from "@/prisma/client"
import { Loader2, Upload, X } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"

export default function TransactionFiles({ transaction, files }: { transaction: Transaction; files: File[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const { showNotification } = useNotification()
  const { t } = useI18n()
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")

  const handleDeleteFile = async (fileId: string) => {
    await deleteTransactionFileAction(transaction.id, fileId)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget
    const files = input.files

    if (!files || files.length === 0) {
      resetFileInputValue(input)
      return
    }

    setIsUploading(true)
    setUploadError("")
    try {
      const result = await uploadFilesWithHttp({
        files,
        transactionId: transaction.id,
      })
      if (!result.success) {
        setUploadError(result.error ? result.error : t("common.errors.generic"))
        return
      }

      notifyUploadSuccess({
        currentPath: pathname,
        destination: "transaction",
        router,
        showNotification,
      })
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : t("common.errors.generic"))
    } finally {
      resetFileInputValue(input)
      setIsUploading(false)
    }
  }

  return (
    <>
      {files.map((file) => (
        <Card key={file.id} className="p-4 relative">
          <Button
            type="button"
            onClick={() => handleDeleteFile(file.id)}
            variant="destructive"
            size="icon"
            className="absolute -right-2 -top-2 rounded-full w-6 h-6 z-10"
          >
            <X className="h-4 w-4" />
          </Button>
          <FilePreview file={file} />
        </Card>
      ))}

      <Card className="relative min-h-32 p-4">
        <input type="hidden" name="transactionId" value={transaction.id} />
        <label
          className="h-full w-full flex flex-col gap-2 items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary transition-colors"
          onDragEnter={(e) => {
            e.currentTarget.classList.add("border-primary")
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove("border-primary")
          }}
        >
          {isUploading ? (
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          ) : (
            <>
              <Upload className="w-8 h-8 text-gray-400" />
              <p className="text-sm text-gray-500">{t("transactions.invoiceFiles.addMore")}</p>
              <p className="text-xs text-gray-500">{t("transactions.invoiceFiles.dropHint")}</p>
              {uploadError && <FormError>{uploadError}</FormError>}
            </>
          )}
          <input
            multiple
            type="file"
            name="file"
            className="absolute inset-0 top-0 left-0 w-full h-full opacity-0"
            onChange={handleFileChange}
            accept={config.upload.acceptedMimeTypes}
          />
        </label>
      </Card>
    </>
  )
}
