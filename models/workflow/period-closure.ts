import {
  PERIOD_CLOSURE_POSTURE,
  type PeriodClosurePosture,
} from "./contracts.ts"

export type PeriodClosureSignals = {
  blockedCount: number
  needsActionCount: number
  readyToFileCount: number
  filedCount: number
  archived: boolean
}

export function buildPeriodClosurePosture(input: PeriodClosureSignals): PeriodClosurePosture {
  if (input.archived) {
    return {
      code: PERIOD_CLOSURE_POSTURE.ARCHIVED,
      blockedCount: input.blockedCount,
      needsActionCount: input.needsActionCount,
      readyToFileCount: input.readyToFileCount,
      filedCount: input.filedCount,
    }
  }

  if (input.blockedCount > 0) {
    return {
      code: PERIOD_CLOSURE_POSTURE.BLOCKED,
      blockedCount: input.blockedCount,
      needsActionCount: input.needsActionCount,
      readyToFileCount: input.readyToFileCount,
      filedCount: input.filedCount,
    }
  }

  if (input.needsActionCount > 0) {
    return {
      code: PERIOD_CLOSURE_POSTURE.AT_RISK,
      blockedCount: input.blockedCount,
      needsActionCount: input.needsActionCount,
      readyToFileCount: input.readyToFileCount,
      filedCount: input.filedCount,
    }
  }

  if (input.filedCount > 0) {
    return {
      code: PERIOD_CLOSURE_POSTURE.FILED,
      blockedCount: input.blockedCount,
      needsActionCount: input.needsActionCount,
      readyToFileCount: input.readyToFileCount,
      filedCount: input.filedCount,
    }
  }

  if (input.readyToFileCount > 0) {
    return {
      code: PERIOD_CLOSURE_POSTURE.DEFENDIBLE,
      blockedCount: input.blockedCount,
      needsActionCount: input.needsActionCount,
      readyToFileCount: input.readyToFileCount,
      filedCount: input.filedCount,
    }
  }

  return {
    code: PERIOD_CLOSURE_POSTURE.ON_TRACK,
    blockedCount: input.blockedCount,
    needsActionCount: input.needsActionCount,
    readyToFileCount: input.readyToFileCount,
    filedCount: input.filedCount,
  }
}
