import { pdfToImages } from "./pdf.ts"
import { resizeImage } from "./images.ts"
import type { PreviewStorageOwner } from "./storage.ts"

export async function generateFilePreviews(
  owner: PreviewStorageOwner,
  organizationId: string,
  fileId: string,
  filePath: string,
  mimetype: string
): Promise<{ contentType: string; previews: string[] }> {
  if (mimetype === "application/pdf") {
    const { contentType, pages } = await pdfToImages(owner, organizationId, fileId, filePath)
    return { contentType, previews: pages }
  } else if (mimetype.startsWith("image/")) {
    const { contentType, resizedPath } = await resizeImage(owner, organizationId, fileId, filePath)
    return { contentType, previews: [resizedPath] }
  } else {
    return { contentType: mimetype, previews: [filePath] }
  }
}
