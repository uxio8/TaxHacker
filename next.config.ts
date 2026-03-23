import { createRequire } from "node:module"
import path from "node:path"
import type { NextConfig } from "next"

function parseAllowedOriginHost(value: string | undefined): string | null {
  if (!value) {
    return null
  }

  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return null
  }

  if (trimmedValue.includes("://")) {
    return new URL(trimmedValue).host || null
  }

  return trimmedValue
}

function getServerActionAllowedOrigins() {
  const allowedOrigins = new Set<string>()
  const baseUrlHost = parseAllowedOriginHost(process.env.BASE_URL)
  const port = process.env.PORT?.trim() || "7331"
  const configuredOrigins = (process.env.SERVER_ACTIONS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => parseAllowedOriginHost(value))
    .filter((value): value is string => Boolean(value))

  if (baseUrlHost) {
    allowedOrigins.add(baseUrlHost)
  }

  allowedOrigins.add(`localhost:${port}`)
  allowedOrigins.add(`127.0.0.1:${port}`)

  for (const origin of configuredOrigins) {
    allowedOrigins.add(origin)
  }

  return Array.from(allowedOrigins)
}

const require = createRequire(import.meta.url)
const isSentryEnabled =
  process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true"
  && Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN)
  && Boolean(process.env.SENTRY_ORG)
  && Boolean(process.env.SENTRY_PROJECT)
const distDir = process.env.NEXT_DIST_DIR?.trim() || undefined

const nextConfig: NextConfig = {
  distDir,
  eslint: {
    ignoreDuringBuilds: true, // TODO: make me linting again
  },
  images: {
    unoptimized: true, // FIXME: bug on prod, images always empty, investigate later
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "256mb",
      allowedOrigins: getServerActionAllowedOrigins(),
    },
  },
  webpack: (config) => {
    if (!isSentryEnabled) {
      config.resolve ??= {}
      config.resolve.alias ??= {}
      config.resolve.alias["@sentry/nextjs"] = path.resolve("./lib/sentry-noop.ts")
    }

    return config
  },
  turbopack: isSentryEnabled
    ? undefined
    : {
        resolveAlias: {
          "@sentry/nextjs": "./lib/sentry-noop.ts",
        },
      },
}

export default isSentryEnabled
  ? require("@sentry/nextjs").withSentryConfig(nextConfig, {
      silent: !process.env.CI,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      disableLogger: true,
      widenClientFileUpload: true,
      tunnelRoute: "/monitoring",
    })
  : nextConfig
