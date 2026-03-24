import type { Translator } from "@/lib/i18n"

const ANALYSIS_JOB_POLL_INTERVAL_MS = 1500
const ANALYSIS_JOB_TIMEOUT_MS = 10 * 60 * 1000

type AnalysisJobResponse = {
  status: string
  error?: string | null
  result?: Record<string, string> | null
}

export async function pollAnalysisJob({
  jobId,
  t,
  onStepChange,
}: {
  jobId: string
  t: Translator
  onStepChange: (step: string) => void
}) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < ANALYSIS_JOB_TIMEOUT_MS) {
    const response = await fetch(`/api/analysis-jobs/${jobId}`, {
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(t("analysis.readStatusFailed"))
    }

    const job = (await response.json()) as AnalysisJobResponse
    onStepChange(getAnalyzeStepLabel(job.status, t))

    if (job.status === "succeeded") {
      return job.result || {}
    }

    if (job.status === "failed" || job.status === "cancelled") {
      throw new Error(job.error || t("analysis.failed"))
    }

    await new Promise((resolve) => setTimeout(resolve, ANALYSIS_JOB_POLL_INTERVAL_MS))
  }

  throw new Error(t("analysis.timeout"))
}

function getAnalyzeStepLabel(status: string, t: Translator) {
  switch (status) {
    case "queued":
      return t("analysis.queued")
    case "acquiring_lease":
      return t("analysis.acquiringLease")
    case "running":
      return t("analysis.analyzing")
    case "persisting_result":
      return t("analysis.savingResults")
    default:
      return t("analysis.analyzing")
  }
}
