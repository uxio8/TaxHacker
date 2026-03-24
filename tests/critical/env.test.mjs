import assert from "node:assert/strict"
import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import { loadCriticalEnv } from "./env.mjs"

test("loadCriticalEnv compone .env y overrides locales sin perder el entorno explícito", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "critical-env-"))

  await writeFile(
    path.join(tempDir, ".env"),
    ["DATABASE_URL=postgres://root", "PLAYWRIGHT_BASE_URL=http://localhost:7331"].join("\n")
  )
  await writeFile(path.join(tempDir, ".env.localdeploy"), "DATABASE_URL=postgres://localdeploy\n")
  await writeFile(path.join(tempDir, ".env.tunnel"), "CLOUDFLARE_TUNNEL_TOKEN=token-123\n")

  const env = await loadCriticalEnv(tempDir, {
    PLAYWRIGHT_BASE_URL: "https://tax.agentworklab.com",
    KEEP_ME: "yes",
  })

  assert.equal(env.DATABASE_URL, "postgres://localdeploy")
  assert.equal(env.CLOUDFLARE_TUNNEL_TOKEN, "token-123")
  assert.equal(env.PLAYWRIGHT_BASE_URL, "https://tax.agentworklab.com")
  assert.equal(env.KEEP_ME, "yes")
})

test("loadCriticalEnv nunca sobreescribe variables explícitas del shell con ficheros locales", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "critical-env-explicit-"))

  await writeFile(path.join(tempDir, ".env"), "DATABASE_URL=postgres://root\n")
  await writeFile(path.join(tempDir, ".env.localdeploy"), "DATABASE_URL=postgres://localdeploy\n")
  await writeFile(path.join(tempDir, ".env.tunnel"), "CLOUDFLARE_TUNNEL_TOKEN=file-token\n")

  const env = await loadCriticalEnv(tempDir, {
    DATABASE_URL: "postgres://explicit",
    CLOUDFLARE_TUNNEL_TOKEN: "explicit-token",
  })

  assert.equal(env.DATABASE_URL, "postgres://explicit")
  assert.equal(env.CLOUDFLARE_TUNNEL_TOKEN, "explicit-token")
})

test("loadCriticalEnv tolera worktrees sin ficheros de entorno", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "critical-env-empty-"))
  await mkdir(path.join(tempDir, "nested"))

  const env = await loadCriticalEnv(tempDir, {
    DATABASE_URL: "postgres://already-set",
  })

  assert.equal(env.DATABASE_URL, "postgres://already-set")
})
