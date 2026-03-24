import assert from "node:assert/strict"
import test from "node:test"

function rememberEnv(keys) {
  return Object.fromEntries(keys.map((key) => [key, process.env[key]]))
}

function restoreEnv(snapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (typeof value === "undefined") {
      delete process.env[key]
      continue
    }

    process.env[key] = value
  }
}

test("GET /api/health devuelve payload estable con metadata de release", async () => {
  const previousEnv = rememberEnv(["APP_BUILD_SHA", "APP_ENVIRONMENT", "npm_package_version"])

  try {
    process.env.APP_BUILD_SHA = "sha-123456"
    process.env.APP_ENVIRONMENT = "production"
    process.env.npm_package_version = "1.2.3"

    const { GET } = await import("../../../app/api/health/route.ts")
    const response = await GET(new Request("http://localhost/api/health"))

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      ok: true,
      version: "1.2.3",
      buildSha: "sha-123456",
      environment: "production",
    })
  } finally {
    restoreEnv(previousEnv)
  }
})

test("GET /api/health usa defaults explícitos cuando faltan variables de release", async () => {
  const previousEnv = rememberEnv(["APP_BUILD_SHA", "APP_ENVIRONMENT", "npm_package_version"])

  try {
    delete process.env.APP_BUILD_SHA
    delete process.env.APP_ENVIRONMENT
    delete process.env.npm_package_version

    const { GET } = await import("../../../app/api/health/route.ts?defaults")
    const response = await GET(new Request("http://localhost/api/health"))

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      ok: true,
      version: "0.0.1",
      buildSha: "dev",
      environment: "development",
    })
  } finally {
    restoreEnv(previousEnv)
  }
})

test("GET /api/health sigue devolviendo metadata aunque otra config del proceso sea inválida", async () => {
  const previousEnv = rememberEnv(["APP_BUILD_SHA", "APP_ENVIRONMENT", "npm_package_version", "BASE_URL"])

  try {
    process.env.APP_BUILD_SHA = "sha-release"
    process.env.APP_ENVIRONMENT = "production"
    process.env.npm_package_version = "1.2.3"
    process.env.BASE_URL = "not-a-url"

    const { GET } = await import("../../../app/api/health/route.ts?invalid-config")
    const response = await GET(new Request("http://localhost/api/health"))

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      ok: true,
      version: "1.2.3",
      buildSha: "sha-release",
      environment: "production",
    })
  } finally {
    restoreEnv(previousEnv)
  }
})
