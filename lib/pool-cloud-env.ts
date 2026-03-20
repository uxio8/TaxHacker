import "server-only"

export const poolCloudEnv = {
  url: process.env.POOL_CLOUD_URL?.trim() || "",
  token: process.env.POOL_CLOUD_TOKEN?.trim() || "",
  slug: process.env.POOL_CLOUD_SLUG?.trim() || "",
  clientInstanceId: process.env.POOL_CLOUD_CLIENT_INSTANCE_ID?.trim() || "",
} as const

export function isPoolCloudConfigured() {
  return Boolean(poolCloudEnv.url && poolCloudEnv.token && poolCloudEnv.slug)
}
