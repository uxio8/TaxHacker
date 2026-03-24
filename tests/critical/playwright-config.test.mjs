import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import path from "node:path"
import test from "node:test"

const projectRoot = process.cwd()

function readPlaywrightConfig(envOverrides = {}) {
  const code = `
    const { pathToFileURL } = await import("node:url")
    const configUrl = pathToFileURL("${path.join(projectRoot, "playwright.config.ts")}").href + "?t=" + Date.now()
    const { default: config } = await import(configUrl)
    console.log(JSON.stringify({
      baseURL: config.use?.baseURL ?? null,
      hasWebServer: Boolean(config.webServer),
      webServerCommand: config.webServer?.command ?? null,
    }))
  `

  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--input-type=module", "-e", code],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        ...envOverrides,
      },
      encoding: "utf8",
    }
  )

  assert.equal(result.status, 0, result.stderr || result.stdout)
  return JSON.parse(result.stdout.trim())
}

test("playwright gestiona webServer local por defecto", () => {
  const config = readPlaywrightConfig({
    PLAYWRIGHT_BASE_URL: "",
  })

  assert.equal(config.baseURL, "http://127.0.0.1:7331")
  assert.equal(config.hasWebServer, true)
  assert.equal(config.webServerCommand, "npm run local:start")
})

test("playwright no intenta levantar runtime local cuando apunta a una URL externa", () => {
  const config = readPlaywrightConfig({
    PLAYWRIGHT_BASE_URL: "https://tax.agentworklab.com",
  })

  assert.equal(config.baseURL, "https://tax.agentworklab.com")
  assert.equal(config.hasWebServer, false)
  assert.equal(config.webServerCommand, null)
})

for (const localBaseUrl of ["http://localhost:7331", "http://0.0.0.0:7331", "http://[::1]:7331"]) {
  test(`playwright trata ${localBaseUrl} como runtime local gestionado`, () => {
    const config = readPlaywrightConfig({
      PLAYWRIGHT_BASE_URL: localBaseUrl,
    })

    assert.equal(config.baseURL, localBaseUrl)
    assert.equal(config.hasWebServer, true)
    assert.equal(config.webServerCommand, "npm run local:start")
  })
}
