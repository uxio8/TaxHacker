import test from "node:test"
import assert from "node:assert/strict"

import { buildPoolCloudCodexCommand } from "./pool-cloud-codex-command.ts"

test("buildPoolCloudCodexCommand sends the prompt through stdin for non-interactive codex exec", () => {
  const command = buildPoolCloudCodexCommand({
    workingDirectory: "/tmp/ledgerflow-analysis",
    schemaPath: "/tmp/ledgerflow-analysis/schema.json",
    resultPath: "/tmp/ledgerflow-analysis/result.json",
    prompt: "Analiza esta factura",
    attachments: [
      {
        filePath: "/tmp/ledgerflow-analysis/invoice.webp",
      },
    ],
    environment: {
      CODEX_HOME: "/tmp/ledgerflow-analysis/codex-home",
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
    "/tmp/ledgerflow-analysis/schema.json",
    "--output-last-message",
  ])
  assert.ok(command.args.includes("/tmp/ledgerflow-analysis/result.json"))
  assert.ok(command.args.includes("--image"))
  assert.ok(command.args.includes("/tmp/ledgerflow-analysis/invoice.webp"))
  assert.equal(command.args.at(-1), "-")
  assert.equal(command.prompt, "Analiza esta factura")
  assert.equal(command.cwd, "/tmp/ledgerflow-analysis")
  assert.equal(command.env.CODEX_HOME, "/tmp/ledgerflow-analysis/codex-home")
})
