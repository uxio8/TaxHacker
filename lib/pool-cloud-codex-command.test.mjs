import test from "node:test"
import assert from "node:assert/strict"

import { buildPoolCloudCodexCommand } from "./pool-cloud-codex-command.ts"

test("buildPoolCloudCodexCommand sends the prompt through stdin for non-interactive codex exec", () => {
  const command = buildPoolCloudCodexCommand({
    workingDirectory: "/tmp/taxhacker-analysis",
    schemaPath: "/tmp/taxhacker-analysis/schema.json",
    resultPath: "/tmp/taxhacker-analysis/result.json",
    prompt: "Analiza esta factura",
    attachments: [
      {
        filePath: "/tmp/taxhacker-analysis/invoice.webp",
      },
    ],
    environment: {
      CODEX_HOME: "/tmp/taxhacker-analysis/codex-home",
    },
  })

  assert.equal(command.command, "codex")
  assert.deepEqual(command.stdio, ["pipe", "pipe", "pipe"])
  assert.deepEqual(command.args.slice(0, 7), [
    "exec",
    "--skip-git-repo-check",
    "--sandbox",
    "read-only",
    "--output-schema",
    "/tmp/taxhacker-analysis/schema.json",
    "--output-last-message",
  ])
  assert.ok(command.args.includes("/tmp/taxhacker-analysis/result.json"))
  assert.ok(command.args.includes("--image"))
  assert.ok(command.args.includes("/tmp/taxhacker-analysis/invoice.webp"))
  assert.equal(command.args.at(-1), "-")
  assert.equal(command.prompt, "Analiza esta factura")
  assert.equal(command.cwd, "/tmp/taxhacker-analysis")
  assert.equal(command.env.CODEX_HOME, "/tmp/taxhacker-analysis/codex-home")
})
