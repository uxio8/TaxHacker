import { getSession } from "@/lib/auth"
import { ACTIVE_ANALYSIS_JOB_STATUSES } from "@/lib/analysis-jobs"
import { ensureAnalysisWorkerRunning } from "@/lib/analysis-worker-supervisor"
import { requireCurrentOrganizationId } from "@/lib/tenant"
import { getAnalysisJobById } from "@/models/analysis-jobs"
import { NextResponse } from "next/server"

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { jobId } = await params
  const organizationId = await requireCurrentOrganizationId()
  const job = await getAnalysisJobById(session.user.id, jobId, organizationId)
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (ACTIVE_ANALYSIS_JOB_STATUSES.includes(job.status as (typeof ACTIVE_ANALYSIS_JOB_STATUSES)[number])) {
    try {
      await ensureAnalysisWorkerRunning({ currentJobId: job.id })
    } catch (error) {
      console.error("Failed to ensure analysis worker is running during polling:", {
        jobId: job.id,
        error,
      })
    }
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
