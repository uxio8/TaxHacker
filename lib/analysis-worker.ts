import { spawn } from "node:child_process"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { tmpdir } from "node:os"

import { PrismaClient } from "../prisma/client/index.js"
import { requestLLM, type LLMResponse } from "../ai/providers/llmProvider.ts"
import {
  ANALYSIS_JOB_STATUS,
  type AnalysisJobAttachment,
  type AnalysisJobProviderConfig,
} from "./analysis-jobs.ts"
import { recoverStaleAnalysisJobs } from "./analysis-worker-recovery.ts"
import {
  ANALYSIS_WORKER_HEARTBEAT_INTERVAL_MS,
  removeAnalysisWorkerHeartbeat,
  writeAnalysisWorkerHeartbeat,
} from "./analysis-worker-supervisor.ts"
import {
  getPoolCloudClientInstanceId,
  PoolCloudClient,
  POOL_CLOUD_LEASE_OUTCOME,
} from "./pool-cloud-client.ts"
import { classifyPoolCloudLeaseCompletion } from "./pool-cloud-lease-feedback.ts"
import { buildPoolCloudCodexCommand } from "./pool-cloud-codex-command.ts"
import { withTimeout } from "./promise-timeout.ts"
import { getAnalyzedFileName } from "./analyzed-file-name.ts"
import { AI_USAGE_METRIC_KEY, getCurrentMonthlyUsagePeriodKey } from "../models/billing/usage.ts"

const WORKER_POLL_INTERVAL_MS = 1500
const POOL_CLOUD_LEASE_TTL_SEC = 300
const POOL_CLOUD_RENEW_INTERVAL_MS = 30_000
const ANALYSIS_TIMEOUT_MS = 10 * 60 * 1000
const STALE_ANALYSIS_JOB_TIMEOUT_MS = ANALYSIS_TIMEOUT_MS + 60 * 1000

type AnalysisJobRecord = {
  id: string
  userId: string
  fileId: string
  status: string
  prompt: string
  schema: unknown
  attachments: unknown
  providers: unknown
}

export async function runAnalysisWorker() {
  const prisma = new PrismaClient({ log: ["warn", "error"] })
  let stopping = false
  const startedAt = new Date().toISOString()
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let currentJobId: string | null = null

  const writeHeartbeat = async (state: "starting" | "idle" | "running") => {
    await writeAnalysisWorkerHeartbeat({
      pid: process.pid,
      startedAt,
      updatedAt: new Date().toISOString(),
      state,
      currentJobId,
    })
  }

  const stopWorker = () => {
    stopping = true
  }

  process.on("SIGINT", stopWorker)
  process.on("SIGTERM", stopWorker)

  try {
    await writeHeartbeat("starting")

    heartbeatTimer = setInterval(() => {
      void writeHeartbeat(currentJobId ? "running" : "idle")
    }, ANALYSIS_WORKER_HEARTBEAT_INTERVAL_MS)

    const recoveredJobs = await recoverStaleAnalysisJobs(prisma, {
      staleAfterMs: STALE_ANALYSIS_JOB_TIMEOUT_MS,
    })

    if (recoveredJobs > 0) {
      console.warn(`Recovered ${recoveredJobs} stale analysis job(s) before polling for new work`)
    }

    while (!stopping) {
      const job = await claimNextAnalysisJob(prisma)
      if (!job) {
        currentJobId = null
        await writeHeartbeat("idle")
        await sleep(WORKER_POLL_INTERVAL_MS)
        continue
      }

      currentJobId = job.id
      await writeHeartbeat("running")
      await processAnalysisJob(prisma, job)
      currentJobId = null
      await writeHeartbeat("idle")
    }
  } finally {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
    }

    await removeAnalysisWorkerHeartbeat(process.pid)
    await prisma.$disconnect()
  }
}

async function claimNextAnalysisJob(prisma: PrismaClient): Promise<AnalysisJobRecord | null> {
  const job = await prisma.analysisJob.findFirst({
    where: {
      status: ANALYSIS_JOB_STATUS.QUEUED,
    },
    orderBy: {
      createdAt: "asc",
    },
  })

  if (!job) {
    return null
  }

  const claimed = await prisma.analysisJob.updateMany({
    where: {
      id: job.id,
      status: ANALYSIS_JOB_STATUS.QUEUED,
    },
    data: {
      status: ANALYSIS_JOB_STATUS.RUNNING,
      startedAt: new Date(),
      error: null,
    },
  })

  if (!claimed.count) {
    return null
  }

  return {
    id: job.id,
    userId: job.userId,
    fileId: job.fileId,
    status: ANALYSIS_JOB_STATUS.RUNNING,
    prompt: job.prompt,
    schema: job.schema,
    attachments: job.attachments,
    providers: job.providers,
  }
}

async function processAnalysisJob(prisma: PrismaClient, job: AnalysisJobRecord) {
  const providers = job.providers as AnalysisJobProviderConfig[]
  const attachments = job.attachments as AnalysisJobAttachment[]
  const schema = job.schema as Record<string, unknown>
  const errors: string[] = []

  if (!providers.length) {
    await markJobFailed(prisma, job.id, "No providers available for this analysis job")
    return
  }

  for (const provider of providers) {
    try {
      let response: LLMResponse

      if (provider.provider === "pool_cloud") {
        await prisma.analysisJob.update({
          where: { id: job.id },
          data: {
            status: ANALYSIS_JOB_STATUS.ACQUIRING_LEASE,
            selectedProvider: provider.provider,
            error: null,
          },
        })

        response = await requestPoolCloudAnalysis(job.id, job.prompt, schema, attachments)
        } else {
          await prisma.analysisJob.update({
            where: { id: job.id },
            data: {
            status: ANALYSIS_JOB_STATUS.RUNNING,
            selectedProvider: provider.provider,
            error: null,
          },
        })

        response = await withTimeout(
          requestLLM(
            {
              providers: [provider],
            },
            {
              prompt: job.prompt,
              schema,
              attachments: await hydrateAttachmentsForDirectProviders(attachments),
            }
          ),
          {
            timeoutMs: ANALYSIS_TIMEOUT_MS,
            errorMessage: `${provider.provider} analysis timed out`,
          }
        )
      }

      if (response.error) {
        errors.push(`${provider.provider}: ${response.error}`)
        continue
      }

      await prisma.analysisJob.update({
        where: { id: job.id },
        data: {
          status: ANALYSIS_JOB_STATUS.PERSISTING_RESULT,
        },
      })

      await prisma.$transaction(async (tx) => {
        const currentFile = await tx.file.findUnique({
          where: { id: job.fileId },
          select: { filename: true, organizationId: true },
        })

        if (!currentFile) {
          throw new Error(`File ${job.fileId} not found while persisting analysis result`)
        }

        await tx.file.update({
          where: { id: job.fileId },
          data: {
            cachedParseResult: response.output,
            filename: getAnalyzedFileName(currentFile.filename, response.output),
          },
        })

        if (response.tokensUsed && response.tokensUsed > 0) {
          const usagePeriodKey = getCurrentMonthlyUsagePeriodKey(new Date())

          await tx.organizationUsage.upsert({
            where: {
              organizationId_metricKey_periodKey: {
                organizationId: currentFile.organizationId,
                metricKey: AI_USAGE_METRIC_KEY,
                periodKey: usagePeriodKey,
              },
            },
            update: {
              quantity: { increment: 1 },
            },
            create: {
              organizationId: currentFile.organizationId,
              metricKey: AI_USAGE_METRIC_KEY,
              periodKey: usagePeriodKey,
              quantity: 1,
            },
          })
        }

        await tx.analysisJob.update({
          where: { id: job.id },
          data: {
            status: ANALYSIS_JOB_STATUS.SUCCEEDED,
            result: response.output,
            selectedProvider: response.provider,
            tokensUsed: response.tokensUsed || 0,
            finishedAt: new Date(),
            error: null,
          },
        })
      })

      return
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${provider.provider}: ${message}`)
    }
  }

  await markJobFailed(prisma, job.id, errors.join("\n"))
}

async function readAnalysisAttachmentBuffer(attachment: AnalysisJobAttachment) {
  if (attachment.base64) {
    return Buffer.from(attachment.base64, "base64")
  }

  if (attachment.filePath) {
    return readFile(attachment.filePath)
  }

  throw new Error(`Analysis attachment ${attachment.filename} has no available payload`)
}

export async function hydrateAttachmentsForDirectProviders(attachments: AnalysisJobAttachment[]) {
  return Promise.all(
    attachments.map(async (attachment) => ({
      ...attachment,
      base64: attachment.base64 || (await readAnalysisAttachmentBuffer(attachment)).toString("base64"),
    }))
  )
}

export async function materializeAnalysisAttachmentsForPoolCloud(
  workingDirectory: string,
  attachments: AnalysisJobAttachment[]
) {
  const attachmentsDirectory = path.join(workingDirectory, "attachments")
  await mkdir(attachmentsDirectory, { recursive: true })

  return Promise.all(
    attachments.map(async (attachment, index) => {
      const basename = path.basename(attachment.filename || attachment.filePath || `attachment-${index}`)
      const targetPath = path.join(attachmentsDirectory, basename)
      await writeFile(targetPath, await readAnalysisAttachmentBuffer(attachment))

      return {
        filePath: targetPath,
      }
    })
  )
}

async function requestPoolCloudAnalysis(
  jobId: string,
  prompt: string,
  schema: Record<string, unknown>,
  attachments: AnalysisJobAttachment[]
): Promise<LLMResponse> {
  const poolUrl = process.env.POOL_CLOUD_URL?.trim() || ""
  const poolToken = process.env.POOL_CLOUD_TOKEN?.trim() || ""
  const poolSlug = process.env.POOL_CLOUD_SLUG?.trim() || ""

  if (!poolUrl || !poolToken || !poolSlug) {
    throw new Error("POOL_CLOUD_URL, POOL_CLOUD_TOKEN and POOL_CLOUD_SLUG are required")
  }

  const client = new PoolCloudClient({
    url: poolUrl,
    token: poolToken,
    slug: poolSlug,
  })

  const clientInstanceId = getPoolCloudClientInstanceId({
    configuredClientInstanceId: process.env.POOL_CLOUD_CLIENT_INSTANCE_ID?.trim() || "",
    hostname: os.hostname(),
  })

  const lease = await client.acquireLease({
    clientInstanceId,
    consumerId: `analysis-job-${jobId}`,
    leaseTtlSec: POOL_CLOUD_LEASE_TTL_SEC,
  })

  const workingDirectory = await mkdtemp(path.join(tmpdir(), "ledgerflow-analysis-"))
  const codexHome = path.join(workingDirectory, "codex-home")
  const schemaPath = path.join(workingDirectory, "analysis-schema.json")
  const resultPath = path.join(workingDirectory, "analysis-result.json")
  let renewTimer: ReturnType<typeof setInterval> | null = null
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null
  let finalized = false
  let commandStarted = false
  let timedOut = false

  try {
    await mkdir(codexHome, { recursive: true })
    await writeFile(path.join(codexHome, "auth.json"), await client.getAuthSnapshot(lease.leaseId), "utf8")
    await writeFile(schemaPath, JSON.stringify(schema, null, 2), "utf8")
    const materializedAttachments = await materializeAnalysisAttachmentsForPoolCloud(workingDirectory, attachments)

    const commandResult = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
      const command = buildPoolCloudCodexCommand({
        workingDirectory,
        schemaPath,
        resultPath,
        prompt,
        attachments: materializedAttachments,
        environment: {
          ...process.env,
          CODEX_HOME: codexHome,
        },
      })

      const child = spawn(command.command, command.args, {
        cwd: command.cwd,
        env: command.env,
        stdio: command.stdio,
      })

      commandStarted = true
      let stdout = ""
      let stderr = ""

      child.stdin?.end(command.prompt)
      child.stdout?.on("data", (chunk) => {
        stdout += String(chunk)
      })

      child.stderr?.on("data", (chunk) => {
        stderr += String(chunk)
      })

      renewTimer = setInterval(async () => {
        try {
          await client.renewLease(lease.leaseId)
        } catch (error) {
          child.kill("SIGTERM")
          reject(error)
        }
      }, POOL_CLOUD_RENEW_INTERVAL_MS)

      timeoutTimer = setTimeout(() => {
        timedOut = true
        child.kill("SIGTERM")
      }, ANALYSIS_TIMEOUT_MS)

      child.on("error", reject)
      child.on("close", (code) => resolve({ code, stdout, stderr }))
    })

    if (timedOut) {
      await client.completeLease(lease.leaseId, {
        outcome: POOL_CLOUD_LEASE_OUTCOME.TIMED_OUT,
        message: "Codex analysis timed out",
      })
      finalized = true
      throw new Error("Codex analysis timed out")
    }

    if (commandResult.code !== 0) {
      const completion = classifyPoolCloudLeaseCompletion(
        commandResult.stderr.trim() || commandResult.stdout.trim() || "Codex command failed"
      )

      await client.completeLease(lease.leaseId, {
        outcome: completion.outcome,
        message: completion.message,
        usageLimitRetryAt: completion.usageLimitRetryAt,
      })
      finalized = true
      throw new Error(completion.message)
    }

    const result = JSON.parse(await readFile(resultPath, "utf8")) as Record<string, string>

    await client.completeLease(lease.leaseId, {
      outcome: POOL_CLOUD_LEASE_OUTCOME.SUCCEEDED,
      message: "LedgerFlow analysis completed",
    })
    finalized = true

    return {
      output: result,
      provider: "pool_cloud",
      tokensUsed: 0,
    }
  } catch (error) {
    if (!finalized) {
      const completion = classifyPoolCloudLeaseCompletion(error)

      if (commandStarted) {
        await client.completeLease(lease.leaseId, {
          outcome: timedOut ? POOL_CLOUD_LEASE_OUTCOME.TIMED_OUT : completion.outcome,
          message: timedOut ? "Codex analysis timed out" : completion.message,
          usageLimitRetryAt: timedOut ? undefined : completion.usageLimitRetryAt,
        })
      } else {
        await client.releaseLease(lease.leaseId, completion.message)
      }
    }

    throw error
  } finally {
    if (renewTimer) {
      clearInterval(renewTimer)
    }

    if (timeoutTimer) {
      clearTimeout(timeoutTimer)
    }

    await rm(workingDirectory, { recursive: true, force: true })
  }
}

async function markJobFailed(prisma: PrismaClient, jobId: string, error: string) {
  await prisma.analysisJob.update({
    where: { id: jobId },
    data: {
      status: ANALYSIS_JOB_STATUS.FAILED,
      error,
      finishedAt: new Date(),
    },
  })
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
