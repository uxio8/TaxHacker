import { runAnalysisWorker } from "../lib/analysis-worker.ts"

runAnalysisWorker().catch((error) => {
  console.error("Analysis worker crashed:", error)
  process.exitCode = 1
})
