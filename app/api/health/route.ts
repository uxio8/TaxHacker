import { createReleaseMetadata } from "../../../lib/config.ts"

export async function GET() {
  const metadata = createReleaseMetadata()

  return Response.json({
    ok: true,
    ...metadata,
  })
}
