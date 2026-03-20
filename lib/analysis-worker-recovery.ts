import { ANALYSIS_JOB_STATUS } from "./analysis-jobs.ts"

export const STALE_ANALYSIS_JOB_STATUSES = [
  ANALYSIS_JOB_STATUS.ACQUIRING_LEASE,
  ANALYSIS_JOB_STATUS.RUNNING,
  ANALYSIS_JOB_STATUS.PERSISTING_RESULT,
] as const

export const STALE_ANALYSIS_JOB_ERROR =
  "Analysis worker stopped before completing this job. Please retry the analysis."

interface AnalysisJobRecoveryWhere {
  status: {
    in: string[]
  }
  updatedAt: {
    lt: Date
  }
}

interface AnalysisJobRecoveryData {
  status: string
  error: string
  finishedAt: Date
}

interface AnalysisJobRecoveryResult {
  count: number
}

interface AnalysisJobRecoveryStore {
  analysisJob: {
    updateMany(args: {
      where: AnalysisJobRecoveryWhere
      data: AnalysisJobRecoveryData
    }): Promise<AnalysisJobRecoveryResult>
  }
}

type RecoverStaleAnalysisJobsOptions = {
  now?: Date
  staleAfterMs: number
}

export async function recoverStaleAnalysisJobs(
  prisma: AnalysisJobRecoveryStore,
  options: RecoverStaleAnalysisJobsOptions
) {
  const now = options.now || new Date()
  const staleThreshold = new Date(now.getTime() - options.staleAfterMs)
  const recovered = await prisma.analysisJob.updateMany({
    where: {
      status: {
        in: [...STALE_ANALYSIS_JOB_STATUSES],
      },
      updatedAt: {
        lt: staleThreshold,
      },
    },
    data: {
      status: ANALYSIS_JOB_STATUS.FAILED,
      error: STALE_ANALYSIS_JOB_ERROR,
      finishedAt: now,
    },
  })

  return recovered.count
}
