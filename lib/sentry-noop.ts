import type { NextConfig } from "next"

export function init() {}

export function captureException(error: unknown) {
  void error
}

export function captureRequestError(...args: unknown[]) {
  void args
}

export function withSentryConfig(config: NextConfig) {
  return config
}
