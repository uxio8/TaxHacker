import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import { pathToFileURL } from "node:url"

const projectRoot = process.cwd()
const defaultAppName = "LedgerFlow"
const mobileCaptureDescription = `Captura tickets y facturas desde el móvil y revisa tu inbox en ${defaultAppName}.`

async function readProjectFile(relativePath) {
  return readFile(path.resolve(projectRoot, relativePath), "utf8")
}

async function loadManifest(envOverrides = {}) {
  const originalEnv = { ...process.env }

  for (const [key, value] of Object.entries(envOverrides)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }

  try {
    const moduleUrl = pathToFileURL(path.resolve(projectRoot, "app/manifest.ts")).href
    const manifestModule = await import(`${moduleUrl}?t=${Date.now()}-${Math.random()}`)
    return await manifestModule.default()
  } finally {
    process.env = originalEnv
  }
}

function assertSharedPwaMetadata(source) {
  assert.match(source, /applicationName:\s*config\.app\.title/)
  assert.match(source, /manifest:\s*"\/manifest\.webmanifest"/)
  assert.match(source, /\/android-chrome-192x192\.png/)
  assert.match(source, /\/android-chrome-512x512\.png/)
  assert.match(source, /\/apple-touch-icon\.png/)
}

function assertDescriptionBinding(source, expectedOccurrences) {
  assert.equal(
    source.match(/description:\s*config\.app\.description/g)?.length ?? 0,
    expectedOccurrences
  )
  assert.doesNotMatch(source, new RegExp(mobileCaptureDescription.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
}

test("el manifest dinámico expone el contrato PWA móvil instalable con branding configurable", async () => {
  const manifest = await loadManifest()

  assert.equal(manifest.name, defaultAppName)
  assert.equal(manifest.short_name, defaultAppName)
  assert.equal(
    manifest.description,
    `Captura tickets y facturas desde el móvil y revisa tu inbox en ${defaultAppName}.`
  )
  assert.equal(manifest.start_url, "/capture?source=pwa")
  assert.equal(manifest.scope, "/")
  assert.equal(manifest.display, "standalone")
  assert.equal(manifest.background_color, "#ffffff")
  assert.equal(manifest.theme_color, "#ffffff")
  assert.deepEqual(manifest.icons, [
    {
      src: "/android-chrome-192x192.png",
      sizes: "192x192",
      type: "image/png",
    },
    {
      src: "/android-chrome-512x512.png",
      sizes: "512x512",
      type: "image/png",
    },
  ])
  assert.deepEqual(manifest.shortcuts, [
    {
      name: "Captura",
      short_name: "Captura",
      description: "Abrir la captura móvil",
      url: "/capture",
      icons: [
        {
          src: "/android-chrome-192x192.png",
          sizes: "192x192",
          type: "image/png",
        },
      ],
    },
    {
      name: "Inbox móvil",
      short_name: "Inbox",
      description: "Revisar la bandeja móvil",
      url: "/capture/inbox",
      icons: [
        {
          src: "/android-chrome-192x192.png",
          sizes: "192x192",
          type: "image/png",
        },
      ],
    },
  ])
})

test("el manifest dinámico admite sobrescribir el nombre público de la app", async () => {
  const manifest = await loadManifest({
    APP_NAME: "PaperTrail",
  })

  assert.equal(manifest.name, "PaperTrail")
  assert.equal(manifest.short_name, "PaperTrail")
  assert.equal(manifest.description, "Captura tickets y facturas desde el móvil y revisa tu inbox en PaperTrail.")
})

test("los layouts raíz y app comparten la metadata PWA esencial", async () => {
  const rootLayout = await readProjectFile("app/layout.tsx")
  const appLayout = await readProjectFile("app/(app)/layout.tsx")

  assertSharedPwaMetadata(rootLayout)
  assertSharedPwaMetadata(appLayout)
  assertDescriptionBinding(rootLayout, 3)
  assertDescriptionBinding(appLayout, 1)
})
