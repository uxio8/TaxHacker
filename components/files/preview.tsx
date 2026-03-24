"use client"

import { useI18n } from "@/lib/i18n"
import { getAnalyzedDocumentTitle } from "@/lib/analyzed-file-name"
import { formatBytes } from "@/lib/utils"
import { File } from "@/prisma/client"
import Image from "next/image"
import Link from "next/link"
import { useState } from "react"

export function FilePreview({ file }: { file: File }) {
  const { t } = useI18n()
  const [isEnlarged, setIsEnlarged] = useState(false)
  const documentTitle = getAnalyzedDocumentTitle(
    file.filename,
    file.cachedParseResult as Record<string, unknown> | null | undefined
  )

  const fileSize =
    file.metadata && typeof file.metadata === "object" && "size" in file.metadata ? Number(file.metadata.size) : 0

  return (
    <>
      <div className="flex flex-col gap-2 p-4 overflow-hidden">
        <div className="aspect-[3/4]">
          <Image
            src={`/files/preview/${file.id}`}
            alt={documentTitle}
            width={300}
            height={400}
            loading="lazy"
            className={`${
              isEnlarged
                ? "fixed inset-0 z-50 m-auto w-screen h-screen object-contain cursor-zoom-out"
                : "w-full h-full object-contain cursor-zoom-in"
            }`}
            onClick={() => setIsEnlarged(!isEnlarged)}
          />
          {isEnlarged && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={() => setIsEnlarged(false)} />
          )}
        </div>
        <div className="flex flex-col gap-2 mt-2 overflow-hidden">
          <h2 className="text-md underline font-semibold overflow-ellipsis">
            <Link href={`/files/download/${file.id}`}>{documentTitle}</Link>
          </h2>
          <p className="text-sm overflow-ellipsis">
            <strong>{t("files.preview.type")}</strong> {file.mimetype}
          </p>
          {/* <p className="text-sm overflow-ellipsis">
            <strong>Uploaded:</strong> {format(file.createdAt, "MMM d, yyyy")}
          </p> */}
          <p className="text-sm">
            <strong>{t("files.preview.size")}</strong> {formatBytes(fileSize)}
          </p>
        </div>
      </div>
    </>
  )
}
