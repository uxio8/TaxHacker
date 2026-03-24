import assert from "node:assert/strict"
import path from "node:path"
import test from "node:test"
import { pathToFileURL } from "node:url"

async function loadNextConfig(envOverrides = {}) {
  const originalEnv = { ...process.env }

  process.env.BASE_URL = "http://localhost:7331"
  process.env.PORT = "7331"
  process.env.SERVER_ACTIONS_ALLOWED_ORIGINS = ""
  process.env.NEXT_PUBLIC_SENTRY_DSN = ""
  process.env.SENTRY_ORG = ""
  process.env.SENTRY_PROJECT = ""

  for (const [key, value] of Object.entries(envOverrides)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }

  try {
    const configUrl = pathToFileURL(path.resolve(process.cwd(), "next.config.ts")).href
    const nextConfigModule = await import(`${configUrl}?t=${Date.now()}-${Math.random()}`)
    return nextConfigModule.default
  } finally {
    process.env = originalEnv
  }
}

test("next config allows local server action origins by default", async () => {
  const config = await loadNextConfig()
  const allowedOrigins = config.experimental?.serverActions?.allowedOrigins ?? []

  assert.ok(allowedOrigins.includes("localhost:7331"))
  assert.ok(allowedOrigins.includes("127.0.0.1:7331"))
})

test("next config appends explicit server action origins from env", async () => {
  const config = await loadNextConfig({
    SERVER_ACTIONS_ALLOWED_ORIGINS: "ledgerflow.local,app.ledgerflow.local:8443",
  })
  const allowedOrigins = config.experimental?.serverActions?.allowedOrigins ?? []

  assert.ok(allowedOrigins.includes("ledgerflow.local"))
  assert.ok(allowedOrigins.includes("app.ledgerflow.local:8443"))
})

test("next config respects a custom distDir for isolated runtimes", async () => {
  const config = await loadNextConfig({
    NEXT_DIST_DIR: ".next.localdeploy",
  })

  assert.equal(config.distDir, ".next.localdeploy")
})
