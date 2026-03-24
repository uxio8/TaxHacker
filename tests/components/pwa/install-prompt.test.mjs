import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

import {
  INSTALL_PROMPT_PLATFORM,
  getConsumedInstallPromptState,
  getInstallPromptState,
} from "../../../components/pwa/use-install-prompt.ts"

const projectRoot = process.cwd()

async function readProjectFile(relativePath) {
  return readFile(path.resolve(projectRoot, relativePath), "utf8")
}

test("getInstallPromptState oculta el CTA cuando la app ya está instalada en standalone", () => {
  const state = getInstallPromptState({
    hasBeforeInstallPrompt: true,
    navigatorStandalone: false,
    standaloneMedia: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  })

  assert.equal(state.platform, INSTALL_PROMPT_PLATFORM.IOS)
  assert.equal(state.isStandalone, true)
  assert.equal(state.canInstall, false)
  assert.equal(state.showIosFallback, false)
  assert.equal(state.shouldRender, false)
})

test("getInstallPromptState expone CTA instalable cuando beforeinstallprompt está disponible", () => {
  const state = getInstallPromptState({
    hasBeforeInstallPrompt: true,
    navigatorStandalone: false,
    standaloneMedia: false,
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36",
  })

  assert.equal(state.platform, INSTALL_PROMPT_PLATFORM.ANDROID)
  assert.equal(state.isStandalone, false)
  assert.equal(state.canInstall, true)
  assert.equal(state.showIosFallback, false)
  assert.equal(state.shouldRender, true)
})

test("getInstallPromptState no muestra CTA en escritorio aunque beforeinstallprompt exista", () => {
  const state = getInstallPromptState({
    hasBeforeInstallPrompt: true,
    navigatorStandalone: false,
    standaloneMedia: false,
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  })

  assert.equal(state.platform, INSTALL_PROMPT_PLATFORM.DESKTOP)
  assert.equal(state.isStandalone, false)
  assert.equal(state.canInstall, false)
  assert.equal(state.showIosFallback, false)
  assert.equal(state.shouldRender, false)
})

test("getInstallPromptState muestra fallback corto en iOS Safari cuando no existe prompt nativo", () => {
  const state = getInstallPromptState({
    hasBeforeInstallPrompt: false,
    navigatorStandalone: false,
    standaloneMedia: false,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  })

  assert.equal(state.platform, INSTALL_PROMPT_PLATFORM.IOS)
  assert.equal(state.isStandalone, false)
  assert.equal(state.canInstall, false)
  assert.equal(state.showIosFallback, true)
  assert.equal(state.shouldRender, true)
})

test("getInstallPromptState no renderiza nada cuando el dispositivo no es instalable ni necesita fallback", () => {
  const state = getInstallPromptState({
    hasBeforeInstallPrompt: false,
    navigatorStandalone: false,
    standaloneMedia: false,
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  })

  assert.equal(state.platform, INSTALL_PROMPT_PLATFORM.DESKTOP)
  assert.equal(state.isStandalone, false)
  assert.equal(state.canInstall, false)
  assert.equal(state.showIosFallback, false)
  assert.equal(state.shouldRender, false)
})

test("getConsumedInstallPromptState oculta el CTA tras consumir un beforeinstallprompt descartado", () => {
  const state = getConsumedInstallPromptState({
    navigatorStandalone: false,
    standaloneMedia: false,
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36",
  })

  assert.equal(state.platform, INSTALL_PROMPT_PLATFORM.ANDROID)
  assert.equal(state.isStandalone, false)
  assert.equal(state.canInstall, false)
  assert.equal(state.showIosFallback, false)
  assert.equal(state.shouldRender, false)
})

test("el componente e integración en capture mantienen una UX ligera y contextual", async () => {
  const [componentSource, capturePageSource, mobileMenuSource, messagesSource] = await Promise.all([
    readProjectFile("components/pwa/install-prompt.tsx"),
    readProjectFile("app/(app)/capture/page.tsx"),
    readProjectFile("components/sidebar/mobile-menu.tsx"),
    readProjectFile("lib/i18n/messages.ts"),
  ])

  assert.match(componentSource, /showIosFallback/)
  assert.match(componentSource, /promptInstall/)
  assert.match(capturePageSource, /InstallPrompt/)
  assert.match(capturePageSource, /capture\.title/)
  assert.doesNotMatch(capturePageSource, /Mobile capture/)
  assert.doesNotMatch(mobileMenuSource, /InstallPrompt/)
  assert.doesNotMatch(mobileMenuSource, /variant="compact"/)
  assert.match(messagesSource, /capture\.install\.cta/)
  assert.match(messagesSource, /capture\.install\.ios/)
})
