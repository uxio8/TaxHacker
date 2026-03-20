import { getSession } from "@/lib/auth"
import { getAnalysisJobById } from "@/models/analysis-jobs"
import { NextResponse } from "next/server"

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { jobId } = await params
  const job = await getAnalysisJobById(session.user.id, jobId)
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({
    id: job.id,
    status: job.status,
    error: job.error,
    result: job.result,
    selectedProvider: job.selectedProvider,
    tokensUsed: job.tokensUsed,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  })
}
