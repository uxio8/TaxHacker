import { prisma } from "@/lib/db"
import { resolveLlmProviderConfigs } from "@/lib/llm-providers"
import { isPoolCloudConfigured } from "@/lib/pool-cloud-env"
import { cache } from "react"
import { LLMProvider } from "@/ai/providers/llmProvider"

export type SettingsMap = Record<string, string>

/**
 * Helper to extract LLM provider settings from SettingsMap.
 */
export function getLLMSettings(settings: SettingsMap) {
  return {
    providers: resolveLlmProviderConfigs(settings, {
      isPoolCloudEnabled: isPoolCloudConfigured(),
    }).map((provider) => ({
      ...provider,
      provider: provider.provider as LLMProvider,
    })),
  }
}

export const getSettings = cache(async (userId: string): Promise<SettingsMap> => {
  const settings = await prisma.setting.findMany({
    where: { userId },
  })

  return settings.reduce((acc, setting) => {
    acc[setting.code] = setting.value || ""
    return acc
  }, {} as SettingsMap)
})

export const updateSettings = cache(async (userId: string, code: string, value: string | undefined) => {
  return await prisma.setting.upsert({
    where: { userId_code: { code, userId } },
    update: { value },
    create: {
      code,
      value,
      name: code,
      userId,
    },
  })
})
