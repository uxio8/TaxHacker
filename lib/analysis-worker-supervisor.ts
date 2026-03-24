import { spawn } from "node:child_process"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"

export const ANALYSIS_WORKER_HEARTBEAT_INTERVAL_MS = 5_000
export const ANALYSIS_WORKER_HEARTBEAT_STALE_AFTER_MS = 20_000
export const ANALYSIS_WORKER_LAUNCH_LOCK_STALE_AFTER_MS = 10_000

export type AnalysisWorkerHeartbeat = {
  pid: number
  startedAt: string
  updatedAt: string
  state: "starting" | "idle" | "running"
  currentJobId: string | null
}

type AnalysisWorkerLaunchLock = {
  pid: number
  createdAt: string
}

type EnsureAnalysisWorkerRunningOptions = {
  now?: Date
  currentJobId?: string | null
}

type EnsureAnalysisWorkerRunningResult = {
  started: boolean
  reason:
    | "already_running"
    | "launch_in_progress"
    | "autostart_disabled"
    | "spawned"
    | "spawn_failed"
}

function getUploadPath() {
  return path.resolve(process.env.UPLOAD_PATH || "./uploads")
}

export function getAnalysisWorkerRuntimeDirectory() {
  return path.resolve(getUploadPath(), "..", "runtime")
}

export function getAnalysisWorkerHeartbeatPath() {
  return path.join(getAnalysisWorkerRuntimeDirectory(), "analysis-worker-heartbeat.json")
}

function getAnalysisWorkerLaunchLockPath() {
  return path.join(getAnalysisWorkerRuntimeDirectory(), "analysis-worker-launching.json")
}

export function isAnalysisWorkerAutostartEnabled() {
  return (process.env.ANALYSIS_WORKER_AUTOSTART || "true").trim().toLowerCase() !== "false"
}

export function isAnalysisWorkerHeartbeatFresh(
  heartbeat: Pick<AnalysisWorkerHeartbeat, "updatedAt">,
  now = new Date(),
  staleAfterMs = ANALYSIS_WORKER_HEARTBEAT_STALE_AFTER_MS
) {
  const updatedAt = new Date(heartbeat.updatedAt)
  if (Number.isNaN(updatedAt.getTime())) {
    return false
  }

  return now.getTime() - updatedAt.getTime() <= staleAfterMs
}

export function shouldStartAnalysisWorker(params: {
  heartbeat: AnalysisWorkerHeartbeat | null
  heartbeatPidAlive: boolean
  launchLock: AnalysisWorkerLaunchLock | null
  now?: Date
  heartbeatStaleAfterMs?: number
  launchLockStaleAfterMs?: number
}) {
  const now = params.now || new Date()

  if (params.heartbeat && params.heartbeatPidAlive) {
    return !isAnalysisWorkerHeartbeatFresh(params.heartbeat, now, params.heartbeatStaleAfterMs)
  }

  if (!params.launchLock) {
    return true
  }

  const createdAt = new Date(params.launchLock.createdAt)
  if (Number.isNaN(createdAt.getTime())) {
    return true
  }

  return now.getTime() - createdAt.getTime() > (params.launchLockStaleAfterMs || ANALYSIS_WORKER_LAUNCH_LOCK_STALE_AFTER_MS)
}

export async function readAnalysisWorkerHeartbeat() {
  try {
    return JSON.parse(await readFile(getAnalysisWorkerHeartbeatPath(), "utf8")) as AnalysisWorkerHeartbeat
  } catch {
    return null
  }
}

async function readAnalysisWorkerLaunchLock() {
  try {
    return JSON.parse(await readFile(getAnalysisWorkerLaunchLockPath(), "utf8")) as AnalysisWorkerLaunchLock
  } catch {
    return null
  }
}

export async function writeAnalysisWorkerHeartbeat(heartbeat: AnalysisWorkerHeartbeat) {
  await mkdir(getAnalysisWorkerRuntimeDirectory(), { recursive: true })
  await writeFile(getAnalysisWorkerHeartbeatPath(), JSON.stringify(heartbeat, null, 2), "utf8")
}

export async function removeAnalysisWorkerHeartbeat(pid?: number) {
  if (pid) {
    const heartbeat = await readAnalysisWorkerHeartbeat()
    if (heartbeat && heartbeat.pid !== pid) {
      return
    }
  }

  await rm(getAnalysisWorkerHeartbeatPath(), { force: true })
}

async function writeAnalysisWorkerLaunchLock(lock: AnalysisWorkerLaunchLock) {
  await mkdir(getAnalysisWorkerRuntimeDirectory(), { recursive: true })
  await writeFile(getAnalysisWorkerLaunchLockPath(), JSON.stringify(lock, null, 2), {
    encoding: "utf8",
    flag: "wx",
  })
}

async function removeAnalysisWorkerLaunchLock() {
  await rm(getAnalysisWorkerLaunchLockPath(), { force: true })
}

export function isProcessAlive(pid: number) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false
  }

  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export async function ensureAnalysisWorkerRunning(
  options: EnsureAnalysisWorkerRunningOptions = {}
): Promise<EnsureAnalysisWorkerRunningResult> {
  if (!isAnalysisWorkerAutostartEnabled()) {
    return { started: false, reason: "autostart_disabled" }
  }

  const now = options.now || new Date()
  const heartbeat = await readAnalysisWorkerHeartbeat()
  const launchLock = await readAnalysisWorkerLaunchLock()
  const heartbeatPidAlive = heartbeat ? isProcessAlive(heartbeat.pid) : false

  if (!shouldStartAnalysisWorker({ heartbeat, heartbeatPidAlive, launchLock, now })) {
    return {
      started: false,
      reason: heartbeat && heartbeatPidAlive ? "already_running" : "launch_in_progress",
    }
  }

  if (launchLock) {
    await removeAnalysisWorkerLaunchLock()
  }

  try {
    await writeAnalysisWorkerLaunchLock({
      pid: process.pid,
      createdAt: now.toISOString(),
    })
  } catch {
    return { started: false, reason: "launch_in_progress" }
  }

  try {
    const child = spawn(process.execPath, ["--experimental-strip-types", "./scripts/analysis-worker.ts"], {
      cwd: process.cwd(),
      env: process.env,
      detached: true,
      stdio: "ignore",
    })

    if (!child.pid) {
      return { started: false, reason: "spawn_failed" }
    }

    child.unref()

    await writeAnalysisWorkerHeartbeat({
      pid: child.pid,
      startedAt: now.toISOString(),
      updatedAt: now.toISOString(),
      state: "starting",
      currentJobId: options.currentJobId || null,
    })

    return { started: true, reason: "spawned" }
  } catch {
    await removeAnalysisWorkerHeartbeat()
    return { started: false, reason: "spawn_failed" }
  } finally {
    await removeAnalysisWorkerLaunchLock()
  }
}
