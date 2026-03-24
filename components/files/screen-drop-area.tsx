"use client"

import { useNotification } from "@/app/(app)/context"
import { useI18n } from "@/lib/i18n"
import { notifyUploadSuccess, uploadFilesWithHttp } from "@/lib/upload-flow"
import { AlertCircle, CloudUpload, Loader2, X } from "lucide-react"
import { useParams, usePathname, useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

export default function ScreenDropArea({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { showNotification } = useNotification()
  const { t } = useI18n()
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const dragCounter = useRef(0)
  const params = useParams()
  const rawTransactionId = params.transactionId
  const transactionId = Array.isArray(rawTransactionId) ? rawTransactionId[0] : rawTransactionId

  const resetDragState = useCallback(() => {
    dragCounter.current = 0
    setIsDragging(false)
  }, [])

  const dismissUploadError = useCallback(() => {
    setUploadError("")
  }, [])

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    // Check if the dragged items are files
    const items = e.dataTransfer.items
    if (!items) return

    let hasFiles = false
    for (const item of items) {
      if (item.kind === "file") {
        hasFiles = true
        break
      }
    }
    if (!hasFiles) return

    dragCounter.current++
    if (dragCounter.current === 1) {
      dismissUploadError()
      setIsDragging(true)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current = Math.max(0, dragCounter.current - 1)

    if (dragCounter.current === 0) {
      setIsDragging(false)
    }
  }

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()

      // Reset counter and dragging state
      resetDragState()

      const files = e.dataTransfer.files
      if (files && files.length > 0) {
        setIsUploading(true)
        dismissUploadError()

        try {
          const result = await uploadFilesWithHttp({
            files,
            transactionId,
          })

          if (result.success) {
            notifyUploadSuccess({
              currentPath: pathname,
              destination: transactionId ? "transaction" : "unsorted",
              router,
              showNotification,
            })
          } else {
            setUploadError(result.error ? result.error : t("common.errors.generic"))
          }
        } catch (error) {
          console.error("Upload error:", error)
          setUploadError(error instanceof Error ? error.message : t("common.errors.generic"))
        } finally {
          setIsUploading(false)
        }
      }
    },
    [dismissUploadError, pathname, resetDragState, router, showNotification, t, transactionId]
  )

  useEffect(() => {
    document.body.addEventListener("dragenter", handleDragEnter as unknown as EventListener)
    document.body.addEventListener("dragover", handleDragOver as unknown as EventListener)
    document.body.addEventListener("dragleave", handleDragLeave as unknown as EventListener)
    document.body.addEventListener("drop", handleDrop as unknown as EventListener)
    window.addEventListener("blur", resetDragState)

    const handleVisibilityChange = () => {
      if (document.hidden) {
        resetDragState()
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.body.removeEventListener("dragenter", handleDragEnter as unknown as EventListener)
      document.body.removeEventListener("dragover", handleDragOver as unknown as EventListener)
      document.body.removeEventListener("dragleave", handleDragLeave as unknown as EventListener)
      document.body.removeEventListener("drop", handleDrop as unknown as EventListener)
      window.removeEventListener("blur", resetDragState)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [handleDrop, resetDragState])

  useEffect(() => {
    if (!uploadError) {
      return
    }

    const timeout = window.setTimeout(() => {
      setUploadError("")
    }, 8000)

    return () => window.clearTimeout(timeout)
  }, [uploadError])

  return (
    <div className="relative min-h-screen w-full">
      {children}

      {isDragging && (
        <div
          className="fixed inset-0 bg-opacity-20 backdrop-blur-sm z-50 flex items-center justify-center"
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl text-center">
            <CloudUpload className="h-16 w-16 mx-auto mb-4 text-primary" />
            <h3 className="text-xl font-semibold mb-2">
              {transactionId ? t("files.upload.dropToAddToTransaction") : t("files.upload.dropToUpload")}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">{t("files.upload.dropAnywhere")}</p>
          </div>
        </div>
      )}

      {isUploading && (
        <div className="fixed inset-0 bg-opacity-20 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl text-center">
            <Loader2 className="h-16 w-16 mx-auto mb-4 text-primary animate-spin" />
            <h3 className="text-xl font-semibold mb-2">
              {transactionId ? t("files.upload.addingToTransaction") : t("files.upload.uploading")}
            </h3>
          </div>
        </div>
      )}

      {uploadError && (
        <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-center sm:justify-end">
          <div className="pointer-events-auto w-full max-w-md rounded-lg border bg-white p-4 shadow-xl dark:bg-gray-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold">{t("files.upload.errorTitle")}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{uploadError}</p>
              </div>
              <button
                type="button"
                onClick={dismissUploadError}
                className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-700 dark:hover:text-white"
                aria-label="Cerrar aviso"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
