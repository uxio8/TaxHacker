import type { Instrumentation } from "next"

const isSentryEnabled =
  process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true" && Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN)

export async function register() {
  if (!isSentryEnabled) {
    return
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config")
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }
}

export async function onRequestError(...args: Parameters<Instrumentation.onRequestError>) {
  if (!isSentryEnabled) {
    return
  }

  const Sentry = await import("@sentry/nextjs")
  return Sentry.captureRequestError(...args)
}
