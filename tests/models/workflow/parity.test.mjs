import assert from "node:assert/strict"
import test from "node:test"

import {
  WORKFLOW_FEATURE_FLAG,
  isWorkflowSurfaceEnabled,
  resolveWorkflowFeatureFlags,
} from "../../../models/workflow/flags.ts"
import {
  buildWorkflowParityReport,
  findInvalidWorkflowPosture,
  findOrphanWorkflowItems,
  measureWorkflowRebuild,
} from "../../../models/workflow/metrics.ts"
import {
  PERIOD_CLOSURE_POSTURE,
  WORKFLOW_CONFIDENCE,
  WORKFLOW_ITEM_SOURCE,
  WORKFLOW_ITEM_STATUS,
  WORKFLOW_MATERIALITY,
  WORKFLOW_SURFACE,
} from "../../../models/workflow/contracts.ts"
import { buildWorkflowReadModelFromSlices } from "../../../models/workflow/rebuild.ts"

function createWorkflowItem(overrides = {}) {
  return {
    id: "document:1",
    title: "Factura pendiente",
    description: "Falta validar la evidencia",
    href: "/unsorted/file_1",
    count: 1,
    status: WORKFLOW_ITEM_STATUS.NEEDS_ACTION,
    source: WORKFLOW_ITEM_SOURCE.DOCUMENTS,
    recommendedSurface: WORKFLOW_SURFACE.UNSORTED,
    materiality: WORKFLOW_MATERIALITY.MEDIUM,
    confidence: WORKFLOW_CONFIDENCE.MEDIUM,
    owner: null,
    dueAt: null,
    nextAction: {
      kind: "open",
      label: "Revisar documento",
      href: "/unsorted/file_1",
    },
    blockingReason: null,
    requiresDesktop: false,
    ...overrides,
  }
}

test("resolveWorkflowFeatureFlags normaliza flags canónicos por superficie", () => {
  const flags = resolveWorkflowFeatureFlags({
    workflow_dashboard_v1: true,
    workflow_transactions_v1: true,
  })

  assert.equal(flags[WORKFLOW_FEATURE_FLAG.DASHBOARD], true)
  assert.equal(flags[WORKFLOW_FEATURE_FLAG.TRANSACTIONS], true)
  assert.equal(flags[WORKFLOW_FEATURE_FLAG.CAPTURE], false)
  assert.equal(isWorkflowSurfaceEnabled(flags, WORKFLOW_SURFACE.DASHBOARD), true)
  assert.equal(isWorkflowSurfaceEnabled(flags, WORKFLOW_SURFACE.TAX), false)
})

test("buildWorkflowParityReport detecta drift entre legacy y read API estable", () => {
  const legacy = buildWorkflowReadModelFromSlices({
    readiness: { pending: 2 },
    items: [
      createWorkflowItem({
        id: "legacy:blocker",
        status: WORKFLOW_ITEM_STATUS.BLOCKED,
        materiality: WORKFLOW_MATERIALITY.HIGH,
      }),
    ],
  })
  const next = buildWorkflowReadModelFromSlices({
    readiness: { pending: 1 },
    items: [
      createWorkflowItem({
        id: "next:ready",
        status: WORKFLOW_ITEM_STATUS.READY,
        materiality: WORKFLOW_MATERIALITY.MEDIUM,
      }),
    ],
  })

  const report = buildWorkflowParityReport({
    surface: WORKFLOW_SURFACE.UNSORTED,
    legacy,
    next,
  })

  assert.equal(report.hasDrift, true)
  assert.equal(report.deltas.itemCount, 0)
  assert.equal(report.deltas.postureChanged, true)
  assert.deepEqual(report.topItemIds, {
    legacy: "legacy:blocker",
    next: "next:ready",
  })
})

test("findOrphanWorkflowItems localiza items lógicos inválidos antes de migrar una UI", () => {
  const orphanIds = findOrphanWorkflowItems([
    createWorkflowItem(),
    createWorkflowItem({
      id: "transaction:missing-href",
      href: "",
    }),
    createWorkflowItem({
      id: "tax:missing-next-action",
      nextAction: {
        kind: "open",
        label: "",
        href: null,
      },
    }),
  ])

  assert.deepEqual(orphanIds, ["tax:missing-next-action", "transaction:missing-href"])
})

test("findInvalidWorkflowPosture marca posturas imposibles antes de endurecer persistencia", () => {
  const readModel = buildWorkflowReadModelFromSlices({
    readiness: null,
    items: [
      createWorkflowItem({
        id: "obligation:filed",
        status: WORKFLOW_ITEM_STATUS.FILED,
      }),
    ],
  })

  const invalid = findInvalidWorkflowPosture({
    ...readModel,
    posture: {
      ...readModel.posture,
      code: PERIOD_CLOSURE_POSTURE.BLOCKED,
    },
  })

  assert.deepEqual(invalid, {
    code: "blocked_without_blockers",
    message: "La postura bloqueada exige al menos un item bloqueado.",
  })
})

test("measureWorkflowRebuild devuelve duración y resultado sin acoplarse a persistencia", async () => {
  const measurement = await measureWorkflowRebuild(async () =>
    buildWorkflowReadModelFromSlices({
      readiness: { pending: 0 },
      items: [createWorkflowItem()],
    })
  )

  assert.equal(typeof measurement.durationMs, "number")
  assert.equal(measurement.result.items.length, 1)
})
