import { getCurrentUser } from "@/lib/auth"
import { getUserUploadsDirectory } from "@/lib/files"
import { readStoredFileBuffer } from "@/lib/storage/runtime"
import { requireCurrentOrganizationId } from "@/lib/tenant"
import { encodeFilename } from "@/lib/utils"
import { getFileById } from "@/models/files"
import { getUserById } from "@/models/users"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params
  const user = await getCurrentUser()
  const organizationId = await requireCurrentOrganizationId({
    getCurrentUser: async () => user,
  })

  if (!fileId) {
    return new NextResponse("No fileId provided", { status: 400 })
  }

  try {
    // Find file in database
    const file = await getFileById(fileId, organizationId)

    if (!file) {
      return new NextResponse("File not found", { status: 404 })
    }

    const ownerUser = await getUserById(file.userId)
    if (!ownerUser) {
      return new NextResponse("File owner not found", { status: 404 })
    }

    const fileBuffer = await readStoredFileBuffer({
      ownerOrganizationId: file.organizationId,
      ownerUploadsDirectory: getUserUploadsDirectory(ownerUser),
      storedPath: file.path,
    })

    // Return file with proper content type and encoded filename
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": file.mimetype,
          "Content-Disposition": `attachment; filename*=${encodeFilename(file.filename)}`,
        },
    })
  } catch (error) {
    console.error("Error serving file:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
