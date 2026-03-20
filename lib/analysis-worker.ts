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
import {
  getPoolCloudClientInstanceId,
  PoolCloudClient,
  POOL_CLOUD_LEASE_OUTCOME,
} from "./pool-cloud-client.ts"

const WORKER_POLL_INTERVAL_MS = 1500
const POOL_CLOUD_LEASE_TTL_SEC = 300
const POOL_CLOUD_RENEW_INTERVAL_MS = 30_000
const ANALYSIS_TIMEOUT_MS = 10 * 60 * 1000

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

  const stopWorker = () => {
    stopping = true
  }

  process.on("SIGINT", stopWorker)
  process.on("SIGTERM", stopWorker)

  try {
    while (!stopping) {
      const job = await claimNextAnalysisJob(prisma)
      if (!job) {
        await sleep(WORKER_POLL_INTERVAL_MS)
        continue
      }

      await processAnalysisJob(prisma, job)
    }
  } finally {
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

        response = await requestLLM(
          {
            providers: [provider],
          },
          {
            prompt: job.prompt,
            schema,
            attachments: await hydrateAttachmentsForDirectProviders(attachments),
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
        await tx.file.update({
          where: { id: job.fileId },
          data: {
            cachedParseResult: response.output,
          },
        })

        if (response.tokensUsed && response.tokensUsed > 0) {
          await tx.user.update({
            where: { id: job.userId },
            data: {
              aiBalance: { decrement: 1 },
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

async function hydrateAttachmentsForDirectProviders(attachments: AnalysisJobAttachment[]) {
  return Promise.all(
    attachments.map(async (attachment) => ({
      ...attachment,
      base64: attachment.base64 || Buffer.from(await readFile(attachment.filePath)).toString("base64"),
    }))
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

  const workingDirectory = await mkdtemp(path.join(tmpdir(), "taxhacker-analysis-"))
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

    const commandResult = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
      const args = [
        "exec",
        "--skip-git-repo-check",
        "--sandbox",
        "read-only",
        "--output-schema",
        schemaPath,
        "--output-last-message",
        resultPath,
      ]

      for (const attachment of attachments) {
        if (attachment.filePath) {
          args.push("--image", attachment.filePath)
        }
      }

      args.push(prompt)

      const child = spawn("codex", args, {
        cwd: workingDirectory,
        env: {
          ...process.env,
          CODEX_HOME: codexHome,
        },
      })

      commandStarted = true
      let stdout = ""
      let stderr = ""

      child.stdout.on("data", (chunk) => {
        stdout += String(chunk)
      })

      child.stderr.on("data", (chunk) => {
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
      await client.completeLease(lease.leaseId, {
        outcome: POOL_CLOUD_LEASE_OUTCOME.FAILED,
        message: commandResult.stderr.trim() || commandResult.stdout.trim() || "Codex command failed",
      })
      finalized = true
      throw new Error(commandResult.stderr.trim() || commandResult.stdout.trim() || "Codex command failed")
    }

    const result = JSON.parse(await readFile(resultPath, "utf8")) as Record<string, string>

    await client.completeLease(lease.leaseId, {
      outcome: POOL_CLOUD_LEASE_OUTCOME.SUCCEEDED,
      message: "TaxHacker analysis completed",
    })
    finalized = true

    return {
      output: result,
      provider: "pool_cloud",
      tokensUsed: 0,
    }
  } catch (error) {
    if (!finalized) {
      const message = error instanceof Error ? error.message : String(error)

      if (commandStarted) {
        await client.completeLease(lease.leaseId, {
          outcome: timedOut ? POOL_CLOUD_LEASE_OUTCOME.TIMED_OUT : POOL_CLOUD_LEASE_OUTCOME.FAILED,
          message,
        })
      } else {
        await client.releaseLease(lease.leaseId, message)
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
