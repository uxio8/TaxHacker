import { createPageMetadata } from "@/lib/i18n"
import { notFound } from "next/navigation"

export const metadata = createPageMetadata("files.upload.uploading")

export default function UploadStatusPage() {
  notFound()
}
