import { prisma } from "@/lib/db"
import { resolveLlmProviderConfigs } from "@/lib/llm-providers"
import { isPoolCloudConfigured } from "@/lib/pool-cloud-env"
import { cache } from "react"
import { LLMProvider } from "@/ai/providers/llmProvider"
import { ensureUserDefaultsVersion } from "./defaults"
import { buildOrganizationOwnedCodeWhere, buildOrganizationOwnedCreateData, buildOrganizationOwnedScope } from "./organization-owned"

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

export const getSettings = cache(async (organizationId: string): Promise<SettingsMap> => {
  await ensureUserDefaultsVersion(organizationId)

  const settings = await prisma.setting.findMany({
    where: buildOrganizationOwnedScope(organizationId),
  })

  return settings.reduce((acc, setting) => {
    acc[setting.code] = setting.value || ""
    return acc
  }, {} as SettingsMap)
})

export const updateSettings = cache(async (organizationId: string, code: string, value: string | undefined) => {
  return await prisma.setting.upsert({
    where: buildOrganizationOwnedCodeWhere(organizationId, code),
    update: { value },
    create: buildOrganizationOwnedCreateData(organizationId, {
      code,
      value,
      name: code,
    }),
  })
})
