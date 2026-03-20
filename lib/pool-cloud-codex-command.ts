import type { SpawnOptions } from "node:child_process"

import type { AnalysisJobAttachment } from "./analysis-jobs.ts"

export type PoolCloudCodexCommandParams = {
  workingDirectory: string
  schemaPath: string
  resultPath: string
  prompt: string
  attachments: Pick<AnalysisJobAttachment, "filePath">[]
  environment: NodeJS.ProcessEnv
}

export type PoolCloudCodexCommand = {
  command: string
  args: string[]
  prompt: string
  cwd: string
  env: NodeJS.ProcessEnv
  stdio: SpawnOptions["stdio"]
}

export function buildPoolCloudCodexCommand(
  params: PoolCloudCodexCommandParams
): PoolCloudCodexCommand {
  const args = [
    "exec",
    "--skip-git-repo-check",
    "--sandbox",
    "read-only",
    "--output-schema",
    params.schemaPath,
    "--output-last-message",
    params.resultPath,
  ]

  for (const attachment of params.attachments) {
    if (attachment.filePath) {
      args.push("--image", attachment.filePath)
    }
  }

  args.push("-")

  return {
    command: "codex",
    args,
    prompt: params.prompt,
    cwd: params.workingDirectory,
    env: params.environment,
    stdio: ["pipe", "pipe", "pipe"],
  }
}
