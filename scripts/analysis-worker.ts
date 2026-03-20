import { existsSync } from "node:fs"

import { runAnalysisWorker } from "../lib/analysis-worker.ts"

if (existsSync(".env")) {
  process.loadEnvFile(".env")
}

runAnalysisWorker().catch((error) => {
  console.error("Analysis worker crashed:", error)
  process.exitCode = 1
})
