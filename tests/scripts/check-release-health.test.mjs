import assert from "node:assert/strict"
import test from "node:test"

import {
  checkReleaseHealth,
  isExecutedAsScript,
  parseReleaseHealthArgs,
} from "../../scripts/check-release-health.ts"

test("parseReleaseHealthArgs exige --url y --sha", () => {
  assert.throws(() => parseReleaseHealthArgs([]), /--url/)
  assert.throws(() => parseReleaseHealthArgs(["--url=https://tax.agentworklab.com"]), /--sha/)
})

test("checkReleaseHealth falla si la respuesta no devuelve 200", async () => {
  const result = await checkReleaseHealth(
    {
      url: "https://tax.agentworklab.com/api/health",
      sha: "abc123",
    },
    {
      fetchImpl: async () => new Response(JSON.stringify({ error: "down" }), { status: 503 }),
    }
  )

  assert.equal(result.ok, false)
  assert.match(result.detail, /503/)
})

test("checkReleaseHealth falla si buildSha no coincide", async () => {
  const result = await checkReleaseHealth(
    {
      url: "https://tax.agentworklab.com/api/health",
      sha: "abc123",
    },
    {
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            ok: true,
            version: "0.5.5",
            buildSha: "def456",
            environment: "production",
          }),
          { status: 200 }
        ),
    }
  )

  assert.equal(result.ok, false)
  assert.match(result.detail, /abc123/)
  assert.match(result.detail, /def456/)
})

test("checkReleaseHealth pasa si buildSha coincide", async () => {
  const result = await checkReleaseHealth(
    {
      url: "https://tax.agentworklab.com/api/health",
      sha: "abc123",
    },
    {
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            ok: true,
            version: "0.5.5",
            buildSha: "abc123",
            environment: "production",
          }),
          { status: 200 }
        ),
    }
  )

  assert.deepEqual(result, {
    ok: true,
    detail: "Release verificada correctamente",
    payload: {
      ok: true,
      version: "0.5.5",
      buildSha: "abc123",
      environment: "production",
    },
  })
})

test("isExecutedAsScript resuelve rutas con espacios", () => {
  assert.equal(
    isExecutedAsScript(
      "file:///Users/test/Nuevos%20desarrollos/taxhacker/scripts/check-release-health.ts",
      "/Users/test/Nuevos desarrollos/taxhacker/scripts/check-release-health.ts"
    ),
    true
  )
})
