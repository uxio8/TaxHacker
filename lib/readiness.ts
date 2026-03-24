import { readdir } from "node:fs/promises"
import path from "node:path"

export const GUIDED_MODE = {
  SETUP: "setup",
  DAILY: "daily",
} as const

export type GuidedMode = (typeof GUIDED_MODE)[keyof typeof GUIDED_MODE]

export const READINESS_STEP_KEY = {
  BUSINESS: "business",
  LLM: "llm",
  FISCAL: "fiscal",
  BACKUPS: "backups",
} as const

export type ReadinessStepKey = (typeof READINESS_STEP_KEY)[keyof typeof READINESS_STEP_KEY]

export type ReadinessStep = {
  key: ReadinessStepKey
  title: string
  description: string
  href: string
  actionLabel: string
  complete: boolean
  blocking: boolean
}

export type ReadinessSummary = {
  mode: GuidedMode
  isReady: boolean
  completedCount: number
  totalCount: number
  nextStep: ReadinessStep | null
  steps: ReadinessStep[]
}

export type ReadinessSignals = {
  organizationName?: string | null
  businessAddress?: string | null
  llmConfigured: boolean
  fiscalProfileReady: boolean
  backupReady: boolean
  selfHosted: boolean
}

function hasValue(value?: string | null) {
  return typeof value === "string" && value.trim().length > 0
}

function buildStepCopy(key: ReadinessStepKey) {
  if (key === READINESS_STEP_KEY.BUSINESS) {
    return {
      title: "Completa la empresa",
      description: "Añade la dirección y los datos básicos para trabajar con una sociedad real.",
      href: "/settings/business",
      actionLabel: "Completar empresa",
      blocking: true,
    }
  }

  if (key === READINESS_STEP_KEY.LLM) {
    return {
      title: "Configura el proveedor de IA",
      description: "Sin proveedor activo no se pueden analizar documentos ni alimentar el inbox.",
      href: "/settings/llm",
      actionLabel: "Configurar IA",
      blocking: true,
    }
  }

  if (key === READINESS_STEP_KEY.FISCAL) {
    return {
      title: "Configura el perfil fiscal",
      description: "Hace falta el perfil fiscal para revisar bloqueos, cierres y modelos.",
      href: "/settings/fiscal",
      actionLabel: "Configurar fiscal",
      blocking: true,
    }
  }

  return {
    title: "Activa un backup básico",
    description: "Antes de usar la app en serio, deja al menos una copia de seguridad disponible.",
    href: "/settings/backups",
    actionLabel: "Revisar backups",
    blocking: false,
  }
}

export function buildReadinessSummary(input: ReadinessSignals): ReadinessSummary {
  const steps: ReadinessStep[] = [
    {
      key: READINESS_STEP_KEY.BUSINESS,
      complete: hasValue(input.organizationName) && hasValue(input.businessAddress),
      ...buildStepCopy(READINESS_STEP_KEY.BUSINESS),
    },
    {
      key: READINESS_STEP_KEY.LLM,
      complete: input.llmConfigured,
      ...buildStepCopy(READINESS_STEP_KEY.LLM),
    },
    {
      key: READINESS_STEP_KEY.FISCAL,
      complete: input.fiscalProfileReady,
      ...buildStepCopy(READINESS_STEP_KEY.FISCAL),
    },
    {
      key: READINESS_STEP_KEY.BACKUPS,
      complete: !input.selfHosted || input.backupReady,
      ...buildStepCopy(READINESS_STEP_KEY.BACKUPS),
    },
  ]

  const blockingIncompleteSteps = steps.filter((step) => step.blocking && !step.complete)
  const incompleteSteps = steps.filter((step) => !step.complete)

  return {
    mode: blockingIncompleteSteps.length > 0 ? GUIDED_MODE.SETUP : GUIDED_MODE.DAILY,
    isReady: incompleteSteps.length === 0,
    completedCount: steps.filter((step) => step.complete).length,
    totalCount: steps.length,
    nextStep: blockingIncompleteSteps[0] ?? incompleteSteps[0] ?? null,
    steps,
  }
}

export async function detectLocalBackupBaseline(backupRootPath = path.resolve("backups/local")) {
  try {
    const entries = await readdir(backupRootPath, { withFileTypes: true })
    return entries.some((entry) => entry.isDirectory())
  } catch {
    return false
  }
}
