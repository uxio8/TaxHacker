import { defineConfig } from "@playwright/test"

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:7331"
const databaseUrl = process.env.DATABASE_URL
const webServerEnv = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string")
)

if (databaseUrl) {
  const normalizedDatabaseUrl = new URL(databaseUrl)

  if (!normalizedDatabaseUrl.searchParams.has("connection_limit")) {
    normalizedDatabaseUrl.searchParams.set("connection_limit", "5")
  }

  process.env.DATABASE_URL = normalizedDatabaseUrl.toString()
}

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run local:start",
    url: `${baseURL}/self-hosted`,
    timeout: 180_000,
    reuseExistingServer: true,
    env: webServerEnv,
  },
})
