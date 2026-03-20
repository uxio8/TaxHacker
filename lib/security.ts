export const SELF_HOSTED_ACCESS_COOKIE_NAME = "taxhacker_self_hosted_access"
const textEncoder = new TextEncoder()

function getWebCrypto() {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto API is not available")
  }

  return globalThis.crypto
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, "0")).join("")
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false
  }

  let mismatch = 0

  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }

  return mismatch === 0
}

async function signSelfHostedAccess(adminToken: string, authSecret: string) {
  const key = await getWebCrypto().subtle.importKey(
    "raw",
    textEncoder.encode(authSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )

  return getWebCrypto().subtle.sign("HMAC", key, textEncoder.encode(adminToken))
}

export async function buildSelfHostedAccessCookieValue(adminToken: string, authSecret: string) {
  return toHex(await signSelfHostedAccess(adminToken, authSecret))
}

export async function hasSelfHostedAccess(
  cookieValue: string | null | undefined,
  adminToken: string | null | undefined,
  authSecret: string
) {
  if (!cookieValue || !adminToken) {
    return false
  }

  const expectedValue = await buildSelfHostedAccessCookieValue(adminToken, authSecret)
  return timingSafeEqual(cookieValue, expectedValue)
}
