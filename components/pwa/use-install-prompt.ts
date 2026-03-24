"use client"

import { useEffect, useState } from "react"

export const INSTALL_PROMPT_PLATFORM = {
  ANDROID: "android",
  DESKTOP: "desktop",
  IOS: "ios",
  OTHER: "other",
} as const

type InstallPromptPlatform = (typeof INSTALL_PROMPT_PLATFORM)[keyof typeof INSTALL_PROMPT_PLATFORM]

interface InstallPromptUserChoice {
  outcome: "accepted" | "dismissed"
  platform: string
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<InstallPromptUserChoice>
}

declare global {
  interface Navigator {
    standalone?: boolean
  }

  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent
  }
}

interface InstallPromptStateInput {
  hasBeforeInstallPrompt: boolean
  navigatorStandalone: boolean
  standaloneMedia: boolean
  userAgent: string
}

interface ConsumedInstallPromptStateInput {
  navigatorStandalone: boolean
  standaloneMedia: boolean
  userAgent: string
}

type LegacyMediaQueryList = MediaQueryList & {
  addListener?: (listener: (event: MediaQueryListEvent) => void) => void
  removeListener?: (listener: (event: MediaQueryListEvent) => void) => void
}

interface InstallPromptSnapshot {
  canInstall: boolean
  isStandalone: boolean
  platform: InstallPromptPlatform
  shouldRender: boolean
  showIosFallback: boolean
}

interface UseInstallPromptValue extends InstallPromptSnapshot {
  promptInstall: () => Promise<boolean>
}

const EMPTY_INSTALL_PROMPT_STATE: InstallPromptSnapshot = {
  canInstall: false,
  isStandalone: false,
  platform: INSTALL_PROMPT_PLATFORM.OTHER,
  shouldRender: false,
  showIosFallback: false,
}

function isIosSafari(userAgent: string) {
  const normalizedUserAgent = userAgent.toLowerCase()
  const isIosDevice = /iphone|ipad|ipod|macintosh.*mobile/.test(normalizedUserAgent)
  const isSafariEngine =
    normalizedUserAgent.includes("safari") &&
    !normalizedUserAgent.includes("crios") &&
    !normalizedUserAgent.includes("fxios") &&
    !normalizedUserAgent.includes("edgios")

  return isIosDevice && isSafariEngine
}

export function getInstallPromptPlatform(userAgent: string): InstallPromptPlatform {
  const normalizedUserAgent = userAgent.toLowerCase()

  if (/iphone|ipad|ipod|macintosh.*mobile/.test(normalizedUserAgent)) {
    return INSTALL_PROMPT_PLATFORM.IOS
  }

  if (normalizedUserAgent.includes("android")) {
    return INSTALL_PROMPT_PLATFORM.ANDROID
  }

  if (/macintosh|windows|linux/.test(normalizedUserAgent)) {
    return INSTALL_PROMPT_PLATFORM.DESKTOP
  }

  return INSTALL_PROMPT_PLATFORM.OTHER
}

export function getInstallPromptState(input: InstallPromptStateInput): InstallPromptSnapshot {
  const platform = getInstallPromptPlatform(input.userAgent)
  const isStandalone = input.navigatorStandalone || input.standaloneMedia
  const isMobilePlatform =
    platform === INSTALL_PROMPT_PLATFORM.ANDROID || platform === INSTALL_PROMPT_PLATFORM.IOS
  const canInstall = !isStandalone && isMobilePlatform && input.hasBeforeInstallPrompt
  const showIosFallback = !isStandalone && !canInstall && isIosSafari(input.userAgent)

  return {
    canInstall,
    isStandalone,
    platform,
    shouldRender: canInstall || showIosFallback,
    showIosFallback,
  }
}

export function getConsumedInstallPromptState(input: ConsumedInstallPromptStateInput): InstallPromptSnapshot {
  return getInstallPromptState({
    hasBeforeInstallPrompt: false,
    navigatorStandalone: input.navigatorStandalone,
    standaloneMedia: input.standaloneMedia,
    userAgent: input.userAgent,
  })
}

function readInstallPromptState(hasBeforeInstallPrompt: boolean) {
  if (typeof window === "undefined") {
    return EMPTY_INSTALL_PROMPT_STATE
  }

  return getInstallPromptState({
    hasBeforeInstallPrompt,
    navigatorStandalone: window.navigator.standalone === true,
    standaloneMedia: window.matchMedia("(display-mode: standalone)").matches,
    userAgent: window.navigator.userAgent,
  })
}

function readConsumedInstallPromptState() {
  if (typeof window === "undefined") {
    return EMPTY_INSTALL_PROMPT_STATE
  }

  return getConsumedInstallPromptState({
    navigatorStandalone: window.navigator.standalone === true,
    standaloneMedia: window.matchMedia("(display-mode: standalone)").matches,
    userAgent: window.navigator.userAgent,
  })
}

export function useInstallPrompt(): UseInstallPromptValue {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [snapshot, setSnapshot] = useState<InstallPromptSnapshot>(EMPTY_INSTALL_PROMPT_STATE)

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined
    }

    const standaloneMediaQuery = window.matchMedia("(display-mode: standalone)") as LegacyMediaQueryList

    function syncSnapshot(nextPrompt: BeforeInstallPromptEvent | null) {
      setSnapshot(readInstallPromptState(nextPrompt !== null))
    }

    function handleBeforeInstallPrompt(event: BeforeInstallPromptEvent) {
      event.preventDefault()
      setDeferredPrompt(event)
      syncSnapshot(event)
    }

    function handleInstalled() {
      setDeferredPrompt(null)
      syncSnapshot(null)
    }

    function handleVisibilityChange() {
      syncSnapshot(deferredPrompt)
    }

    syncSnapshot(deferredPrompt)
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleInstalled)
    if (typeof standaloneMediaQuery.addEventListener === "function") {
      standaloneMediaQuery.addEventListener("change", handleInstalled)
    } else if (typeof standaloneMediaQuery.addListener === "function") {
      standaloneMediaQuery.addListener(handleInstalled)
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleInstalled)
      if (typeof standaloneMediaQuery.removeEventListener === "function") {
        standaloneMediaQuery.removeEventListener("change", handleInstalled)
      } else if (typeof standaloneMediaQuery.removeListener === "function") {
        standaloneMediaQuery.removeListener(handleInstalled)
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [deferredPrompt])

  async function promptInstall() {
    if (!deferredPrompt) {
      return false
    }

    await deferredPrompt.prompt()
    const userChoice = await deferredPrompt.userChoice
    const accepted = userChoice.outcome === "accepted"

    setDeferredPrompt(null)
    setSnapshot(readConsumedInstallPromptState())

    return accepted
  }

  return {
    ...snapshot,
    promptInstall,
  }
}
