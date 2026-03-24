import { spawn } from "node:child_process"

import { loadCriticalEnv } from "./env.mjs"
import { CRITICAL_HARNESS_NODE_TESTS, CRITICAL_SURFACES, TYPECHECK_COMMAND } from "./surfaces.mjs"

function collectUniqueEntries(selector) {
  const seen = new Set()
  const result = []

  for (const surface of CRITICAL_SURFACES) {
    for (const entry of selector(surface)) {
      if (!seen.has(entry)) {
        seen.add(entry)
        result.push(entry)
      }
    }
  }

  return result
}

async function runCommand(label, command, args) {
  const env = await loadCriticalEnv(process.cwd())

  return new Promise((resolve, reject) => {
    process.stdout.write(`\n[critical-fast] ${label}\n`)
    process.stdout.write(`[critical-fast] $ ${[command, ...args].join(" ")}\n`)

    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: "inherit",
    })

    child.on("error", reject)
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }

      if (signal) {
        reject(new Error(`${label} interrumpido por señal ${signal}`))
        return
      }

      reject(new Error(`${label} falló con exit code ${code}`))
    })
  })
}

const nodeTests = [
  ...CRITICAL_HARNESS_NODE_TESTS,
  ...collectUniqueEntries((surface) => surface.nodeTests),
]

await runCommand("Next typegen", "./node_modules/.bin/next", ["typegen"])
await runCommand("TypeScript", TYPECHECK_COMMAND[0], TYPECHECK_COMMAND.slice(1))
await runCommand("Node critical suites", "node", ["--test", "--experimental-strip-types", ...nodeTests])
