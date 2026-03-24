import assert from "node:assert/strict"
import test from "node:test"

const workflowContractsModule = await import(new URL("../../../models/workflow/contracts.ts", import.meta.url))
const periodClosureModule = await import(new URL("../../../models/workflow/period-closure.ts", import.meta.url))

test("buildPeriodClosurePosture devuelve blocked cuando hay bloqueos reales", () => {
  const posture = periodClosureModule.buildPeriodClosurePosture({
    blockedCount: 2,
    needsActionCount: 1,
    readyToFileCount: 0,
    filedCount: 0,
    archived: false,
  })

  assert.equal(posture.code, workflowContractsModule.PERIOD_CLOSURE_POSTURE.BLOCKED)
  assert.equal(posture.blockedCount, 2)
})

test("buildPeriodClosurePosture devuelve at_risk cuando no hay bloqueos pero sí trabajo pendiente", () => {
  const posture = periodClosureModule.buildPeriodClosurePosture({
    blockedCount: 0,
    needsActionCount: 3,
    readyToFileCount: 0,
    filedCount: 0,
    archived: false,
  })

  assert.equal(posture.code, workflowContractsModule.PERIOD_CLOSURE_POSTURE.AT_RISK)
})

test("buildPeriodClosurePosture devuelve defendible cuando no hay bloqueos y el expediente está listo", () => {
  const posture = periodClosureModule.buildPeriodClosurePosture({
    blockedCount: 0,
    needsActionCount: 0,
    readyToFileCount: 1,
    filedCount: 0,
    archived: false,
  })

  assert.equal(posture.code, workflowContractsModule.PERIOD_CLOSURE_POSTURE.DEFENDIBLE)
})

test("buildPeriodClosurePosture devuelve filed y archived en el tramo final", () => {
  const filed = periodClosureModule.buildPeriodClosurePosture({
    blockedCount: 0,
    needsActionCount: 0,
    readyToFileCount: 0,
    filedCount: 1,
    archived: false,
  })

  const archived = periodClosureModule.buildPeriodClosurePosture({
    blockedCount: 0,
    needsActionCount: 0,
    readyToFileCount: 0,
    filedCount: 1,
    archived: true,
  })

  assert.equal(filed.code, workflowContractsModule.PERIOD_CLOSURE_POSTURE.FILED)
  assert.equal(archived.code, workflowContractsModule.PERIOD_CLOSURE_POSTURE.ARCHIVED)
})
