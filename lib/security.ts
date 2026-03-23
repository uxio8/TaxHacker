export const SELF_HOSTED_ACCESS_COOKIE_NAME = "taxhacker_self_hosted_access"
export const PLATFORM_IMPERSONATION_COOKIE_NAME = "taxhacker_platform_impersonation"
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
  return signPayload(adminToken, authSecret)
}

async function signPayload(payload: string, authSecret: string) {
  const key = await getWebCrypto().subtle.importKey(
    "raw",
    textEncoder.encode(authSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )

  return getWebCrypto().subtle.sign("HMAC", key, textEncoder.encode(payload))
}

export async function buildSelfHostedAccessCookieValue(adminToken: string, authSecret: string) {
  return toHex(await signSelfHostedAccess(adminToken, authSecret))
}

export async function buildPlatformImpersonationCookieValue(
  input: {
    actorUserId: string
    sessionId: string
  },
  authSecret: string
) {
  const payload = `${input.actorUserId}:${input.sessionId}`
  const signature = toHex(await signPayload(payload, authSecret))
  return `${input.sessionId}.${signature}`
}

export async function readPlatformImpersonationCookieSessionId(
  cookieValue: string | null | undefined,
  actorUserId: string,
  authSecret: string
) {
  if (!cookieValue) {
    return null
  }

  const [sessionId, signature] = cookieValue.split(".")

  if (!sessionId || !signature) {
    return null
  }

  const expectedSignature = toHex(await signPayload(`${actorUserId}:${sessionId}`, authSecret))
  return timingSafeEqual(signature, expectedSignature) ? sessionId : null
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
