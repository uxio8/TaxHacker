export function isSentryRuntimeEnabled() {
  return process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true" && Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN)
}

export function isSentryBuildEnabled() {
  return (
    isSentryRuntimeEnabled()
    && Boolean(process.env.SENTRY_ORG)
    && Boolean(process.env.SENTRY_PROJECT)
  )
}
