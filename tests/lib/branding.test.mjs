import assert from "node:assert/strict"
import path from "node:path"
import test from "node:test"
import { pathToFileURL } from "node:url"

const projectRoot = process.cwd()

async function loadConfig(envOverrides = {}) {
  const originalEnv = { ...process.env }

  delete process.env.APP_NAME
  delete process.env.APP_DESCRIPTION
  delete process.env.APP_REPOSITORY_URL
  delete process.env.APP_ISSUES_URL
  delete process.env.APP_DONATE_URL
  delete process.env.RESEND_FROM_EMAIL

  for (const [key, value] of Object.entries(envOverrides)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }

  try {
    const configUrl = pathToFileURL(path.resolve(projectRoot, "lib/config.ts")).href
    const configModule = await import(`${configUrl}?t=${Date.now()}-${Math.random()}`)
    return configModule.default
  } finally {
    process.env = originalEnv
  }
}

test("config expone una marca pública genérica por defecto", async () => {
  const config = await loadConfig()

  assert.equal(config.app.title, "LedgerFlow")
  assert.equal(config.app.slug, "ledgerflow")
  assert.equal(config.app.description, "AI workspace for receipts, invoices, and operations.")
  assert.equal(config.app.demoCompanyName, "LedgerFlow Demo SL")
  assert.equal(config.email.from, "LedgerFlow <user@localhost>")
})

test("config permite sobrescribir la marca pública sin tocar el namespace técnico", async () => {
  const config = await loadConfig({
    APP_NAME: "PaperTrail",
    APP_DESCRIPTION: "Backoffice documental con IA.",
    APP_REPOSITORY_URL: "https://example.com/repo",
    APP_ISSUES_URL: "https://example.com/issues",
    APP_DONATE_URL: "https://example.com/donate",
  })

  assert.equal(config.app.title, "PaperTrail")
  assert.equal(config.app.slug, "papertrail")
  assert.equal(config.app.description, "Backoffice documental con IA.")
  assert.equal(config.app.demoCompanyName, "PaperTrail Demo SL")
  assert.equal(config.email.from, "PaperTrail <user@localhost>")
  assert.equal(config.links.repositoryUrl, "https://example.com/repo")
  assert.equal(config.links.issuesUrl, "https://example.com/issues")
  assert.equal(config.links.donateUrl, "https://example.com/donate")
})
