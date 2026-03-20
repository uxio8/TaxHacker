export const LLM_PROVIDER_KEYS = {
  OPENAI: "openai",
  GOOGLE: "google",
  MISTRAL: "mistral",
  POOL_CLOUD: "pool_cloud",
} as const

export type LLMProviderKey = (typeof LLM_PROVIDER_KEYS)[keyof typeof LLM_PROVIDER_KEYS]

type ProviderHelp = {
  url: string
  label: string
}

export type ProviderMetadata = {
  key: LLMProviderKey
  label: string
  apiKeyName?: string
  modelName?: string
  defaultModelName?: string
  apiDoc?: string
  apiDocLabel?: string
  placeholder?: string
  help?: ProviderHelp
  logo?: string
  managedByEnvironment?: boolean
}

export const PROVIDERS: ProviderMetadata[] = [
  {
    key: LLM_PROVIDER_KEYS.OPENAI,
    label: "OpenAI",
    apiKeyName: "openai_api_key",
    modelName: "openai_model_name",
    defaultModelName: "gpt-4o-mini",
    apiDoc: "https://platform.openai.com/settings/organization/api-keys",
    apiDocLabel: "OpenAI Platform Console",
    placeholder: "sk-...",
    help: {
      url: "https://platform.openai.com/settings/organization/api-keys",
      label: "OpenAI Platform Console",
    },
    logo: "/logo/openai.svg",
  },
  {
    key: LLM_PROVIDER_KEYS.GOOGLE,
    label: "Google",
    apiKeyName: "google_api_key",
    modelName: "google_model_name",
    defaultModelName: "gemini-2.5-flash",
    apiDoc: "https://aistudio.google.com/apikey",
    apiDocLabel: "Google AI Studio",
    placeholder: "...",
    help: {
      url: "https://aistudio.google.com/apikey",
      label: "Google AI Studio",
    },
    logo: "/logo/google.svg",
  },
  {
    key: LLM_PROVIDER_KEYS.MISTRAL,
    label: "Mistral",
    apiKeyName: "mistral_api_key",
    modelName: "mistral_model_name",
    defaultModelName: "mistral-medium-latest",
    apiDoc: "https://admin.mistral.ai/organization/api-keys",
    apiDocLabel: "Mistral Admin Console",
    placeholder: "...",
    help: {
      url: "https://admin.mistral.ai/organization/api-keys",
      label: "Mistral Admin Console",
    },
    logo: "/logo/mistral.svg",
  },
  {
    key: LLM_PROVIDER_KEYS.POOL_CLOUD,
    label: "Pool Cloud",
    managedByEnvironment: true,
    help: {
      url: "https://github.com/uxio8/codex-pool-cloud",
      label: "Pool Cloud setup",
    },
  },
]

export type ResolvedLlmProviderConfig = {
  provider: LLMProviderKey
  apiKey: string
  model: string
}

type ResolveLlmProviderOptions = {
  isPoolCloudEnabled: boolean
}

export function getDefaultProviderOrder(isPoolCloudEnabled: boolean) {
  const directOrder = [LLM_PROVIDER_KEYS.OPENAI, LLM_PROVIDER_KEYS.GOOGLE, LLM_PROVIDER_KEYS.MISTRAL]
  return isPoolCloudEnabled ? [LLM_PROVIDER_KEYS.POOL_CLOUD, ...directOrder] : directOrder
}

export function resolveLlmProviderConfigs(
  settings: Record<string, string>,
  options: ResolveLlmProviderOptions
): ResolvedLlmProviderConfig[] {
  const providerByKey = new Map(PROVIDERS.map((provider) => [provider.key, provider]))
  const requestedOrder = settings.llm_providers
    ? settings.llm_providers.split(",").map((provider) => provider.trim()).filter(Boolean)
    : getDefaultProviderOrder(options.isPoolCloudEnabled)

  const normalizedOrder = requestedOrder.filter((provider, index) => {
    const metadata = providerByKey.get(provider as LLMProviderKey)
    if (!metadata) {
      return false
    }

    if (metadata.key === LLM_PROVIDER_KEYS.POOL_CLOUD && !options.isPoolCloudEnabled) {
      return false
    }

    return requestedOrder.indexOf(provider) === index
  })

  return normalizedOrder.flatMap((providerKey) => {
    const provider = providerByKey.get(providerKey as LLMProviderKey)
    if (!provider) {
      throw new Error(`Unknown provider ${providerKey}`)
    }

    if (provider.managedByEnvironment) {
      return [
        {
          provider: provider.key,
          apiKey: "",
          model: "",
        },
      ]
    }

    const apiKey = provider.apiKeyName ? settings[provider.apiKeyName] || "" : ""
    const model = provider.modelName ? settings[provider.modelName] || provider.defaultModelName || "" : ""

    if (!apiKey || !model) {
      return []
    }

    return [{
      provider: provider.key,
      apiKey,
      model,
    }]
  })
}
