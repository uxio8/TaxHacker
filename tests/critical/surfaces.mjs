export const TYPECHECK_COMMAND = ["npx", "tsc", "--noEmit", "--pretty", "false"]

export const CRITICAL_HARNESS_NODE_TESTS = [
  "tests/critical/contract.test.mjs",
  "tests/critical/env.test.mjs",
  "tests/critical/playwright-config.test.mjs",
]

export const CRITICAL_SURFACES = [
  {
    id: "dashboard",
    rollbackFlag: "WORKFLOW_DOCUMENT_SLICE=0",
    nodeTests: [
      "tests/app/workflow-document-slice-wiring.test.mjs",
      "tests/components/dashboard/attention-center.test.mjs",
    ],
    playwrightSpecs: [],
  },
  {
    id: "unsorted",
    rollbackFlag: "WORKFLOW_DOCUMENT_SLICE=0",
    nodeTests: [
      "tests/app/workflow-document-slice-wiring.test.mjs",
      "tests/components/unsorted/analyze-form-guidance.test.mjs",
    ],
    playwrightSpecs: [],
  },
  {
    id: "capture",
    rollbackFlag: "WORKFLOW_DOCUMENT_SLICE=0",
    nodeTests: [
      "tests/app/capture/routes.test.mjs",
      "tests/app/capture/review-actions.test.mjs",
    ],
    playwrightSpecs: [],
  },
  {
    id: "tax",
    rollbackFlag: "WORKFLOW_FISCAL_SLICE=0",
    nodeTests: [
      "tests/app/workflow-fiscal-slice-wiring.test.mjs",
      "tests/app/tax-review-queue-copy.test.mjs",
    ],
    playwrightSpecs: [
      "tests/e2e/fiscal-obligations-smoke.spec.ts",
      "tests/e2e/fiscal-collaboration-smoke.spec.ts",
    ],
  },
  {
    id: "archive",
    rollbackFlag: "WORKFLOW_FISCAL_SLICE=0",
    nodeTests: [
      "tests/app/workflow-fiscal-slice-wiring.test.mjs",
      "tests/models/fiscal/legal-archive.test.mjs",
    ],
    playwrightSpecs: ["tests/e2e/fiscal-obligations-smoke.spec.ts"],
  },
  {
    id: "transactions",
    rollbackFlag: "WORKFLOW_TRANSACTIONS_SLICE=0",
    nodeTests: [
      "tests/app/workflow-transactions-slice-wiring.test.mjs",
      "tests/app/transactions/fiscal-actions.test.mjs",
      "tests/app/transactions/fiscal-page.test.mjs",
    ],
    playwrightSpecs: ["tests/e2e/counterparty-resolution-smoke.spec.ts"],
  },
  {
    id: "ops",
    rollbackFlag: "none",
    nodeTests: [
      "tests/app/ops-dashboard.test.mjs",
      "tests/app/ops-organization-detail.test.mjs",
    ],
    playwrightSpecs: [],
  },
]

export const CRITICAL_DRIFT_THRESHOLDS = {
  typeErrors: 0,
  nodeSuiteFailures: 0,
  playwrightFailures: 0,
  uncoveredCriticalSurfaces: 0,
}
