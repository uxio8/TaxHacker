import assert from "node:assert/strict"
import test from "node:test"

import { resolveLlmProviderConfigs } from "./llm-providers.ts"

test("resolveLlmProviderConfigs prioritizes pool_cloud when enabled and no custom order exists", () => {
  const resolved = resolveLlmProviderConfigs(
    {
      openai_api_key: "sk-openai",
      openai_model_name: "gpt-4o-mini",
    },
    {
      isPoolCloudEnabled: true,
    }
  )

  assert.deepEqual(
    resolved.map((provider) => provider.provider),
    ["pool_cloud", "openai", "google", "mistral"]
  )
})

test("resolveLlmProviderConfigs preserves explicit order and keeps pool_cloud env-managed", () => {
  const resolved = resolveLlmProviderConfigs(
    {
      llm_providers: "google,pool_cloud,openai",
      google_api_key: "google-key",
      google_model_name: "gemini-2.5-flash",
      openai_api_key: "openai-key",
      openai_model_name: "gpt-4o-mini",
    },
    {
      isPoolCloudEnabled: true,
    }
  )

  assert.deepEqual(resolved, [
    {
      provider: "google",
      apiKey: "google-key",
      model: "gemini-2.5-flash",
    },
    {
      provider: "pool_cloud",
      apiKey: "",
      model: "",
    },
    {
      provider: "openai",
      apiKey: "openai-key",
      model: "gpt-4o-mini",
    },
  ])
})

test("resolveLlmProviderConfigs ignores pool_cloud when the environment is not configured", () => {
  const resolved = resolveLlmProviderConfigs(
    {
      llm_providers: "pool_cloud,openai",
      openai_api_key: "openai-key",
      openai_model_name: "gpt-4o-mini",
    },
    {
      isPoolCloudEnabled: false,
    }
  )

  assert.deepEqual(
    resolved.map((provider) => provider.provider),
    ["openai"]
  )
})
