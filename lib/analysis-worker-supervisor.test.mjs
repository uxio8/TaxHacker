import assert from "node:assert/strict"
import test from "node:test"

import {
  ANALYSIS_WORKER_HEARTBEAT_STALE_AFTER_MS,
  isAnalysisWorkerHeartbeatFresh,
  shouldStartAnalysisWorker,
} from "./analysis-worker-supervisor.ts"

test("isAnalysisWorkerHeartbeatFresh devuelve true cuando el heartbeat sigue dentro del umbral", () => {
  const now = new Date("2026-03-22T12:00:15.000Z")

  assert.equal(
    isAnalysisWorkerHeartbeatFresh(
      {
        updatedAt: "2026-03-22T12:00:00.000Z",
      },
      now,
      ANALYSIS_WORKER_HEARTBEAT_STALE_AFTER_MS
    ),
    true
  )
})

test("shouldStartAnalysisWorker no relanza si el heartbeat es fresco y el proceso sigue vivo", () => {
  const now = new Date("2026-03-22T12:00:15.000Z")

  assert.equal(
    shouldStartAnalysisWorker({
      heartbeat: {
        pid: 12345,
        startedAt: "2026-03-22T11:59:00.000Z",
        updatedAt: "2026-03-22T12:00:00.000Z",
        state: "idle",
        currentJobId: null,
      },
      heartbeatPidAlive: true,
      launchLock: null,
      now,
    }),
    false
  )
})

test("shouldStartAnalysisWorker relanza si el heartbeat esta caducado aunque el pid siga vivo", () => {
  const now = new Date("2026-03-22T12:00:40.000Z")

  assert.equal(
    shouldStartAnalysisWorker({
      heartbeat: {
        pid: 12345,
        startedAt: "2026-03-22T11:59:00.000Z",
        updatedAt: "2026-03-22T12:00:00.000Z",
        state: "idle",
        currentJobId: null,
      },
      heartbeatPidAlive: true,
      launchLock: null,
      now,
    }),
    true
  )
})

test("shouldStartAnalysisWorker espera si ya hay un arranque reciente en curso", () => {
  const now = new Date("2026-03-22T12:00:05.000Z")

  assert.equal(
    shouldStartAnalysisWorker({
      heartbeat: null,
      heartbeatPidAlive: false,
      launchLock: {
        pid: 999,
        createdAt: "2026-03-22T12:00:00.000Z",
      },
      now,
    }),
    false
  )
})
