import { ACTIVE_ANALYSIS_JOB_STATUSES, ANALYSIS_JOB_STATUS, AnalysisJobPayload } from "@/lib/analysis-jobs"
import { prisma } from "@/lib/db"
import { Prisma } from "@/prisma/client"

function toJsonValue<T>(value: T): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

export async function findActiveAnalysisJobForFile(userId: string, fileId: string, organizationId = userId) {
  return prisma.analysisJob.findFirst({
    where: {
      userId,
      organizationId,
      fileId,
      status: {
        in: [...ACTIVE_ANALYSIS_JOB_STATUSES],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  })
}

export async function createAnalysisJob(
  userId: string,
  fileId: string,
  payload: AnalysisJobPayload,
  organizationId = userId
) {
  return prisma.analysisJob.create({
    data: {
      userId,
      organizationId,
      fileId,
      status: ANALYSIS_JOB_STATUS.QUEUED,
      prompt: payload.prompt,
      schema: toJsonValue(payload.schema),
      attachments: toJsonValue(payload.attachments),
      providers: toJsonValue(payload.providers),
    },
  })
}

export async function getAnalysisJobById(userId: string, id: string, organizationId = userId) {
  return prisma.analysisJob.findFirst({
    where: {
      id,
      userId,
      organizationId,
    },
  })
}
