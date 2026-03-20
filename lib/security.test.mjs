import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { normalizeBackupFilePath, resolvePathWithinBase, resolveRelativePath } from "./file-security.ts"
import {
  buildSelfHostedAccessCookieValue,
  hasSelfHostedAccess,
} from "./security.ts"

test("resolvePathWithinBase keeps files inside the base directory", () => {
  assert.equal(
    resolvePathWithinBase("/app/data/uploads/user", "2025/03/file.pdf"),
    "/app/data/uploads/user/2025/03/file.pdf"
  )
})

test("resolvePathWithinBase rejects sibling-prefix traversal", () => {
  assert.throws(() => resolvePathWithinBase("/app/data/uploads/user", "../user-evil/file.pdf"), /Path traversal detected/)
})

test("resolveRelativePath keeps generated storage paths relative", () => {
  assert.equal(resolveRelativePath("unsorted", "receipt.webp"), "unsorted/receipt.webp")
})

test("resolveRelativePath rejects traversal segments", () => {
  assert.throws(() => resolveRelativePath("unsorted", "../receipt.webp"), /Invalid relative path/)
})

test("normalizeBackupFilePath strips uploads prefix from safe paths", () => {
  assert.equal(normalizeBackupFilePath("/app/data/uploads/user@example.com/2025/03/file.pdf"), "2025/03/file.pdf")
})

test("normalizeBackupFilePath rejects traversal paths", () => {
  assert.throws(() => normalizeBackupFilePath("../../etc/passwd"), /Invalid backup file path/)
})

test("hasSelfHostedAccess accepts a valid signed cookie", async () => {
  const secret = "0123456789abcdef0123456789abcdef"
  const token = "super-secret-token"
  const cookieValue = await buildSelfHostedAccessCookieValue(token, secret)

  assert.equal(await hasSelfHostedAccess(cookieValue, token, secret), true)
})

test("hasSelfHostedAccess rejects a tampered cookie", async () => {
  const secret = "0123456789abcdef0123456789abcdef"
  const token = "super-secret-token"

  assert.equal(await hasSelfHostedAccess("tampered", token, secret), false)
})

test("security helpers stay compatible with the edge runtime", async () => {
  const source = await readFile(new URL("./security.ts", import.meta.url), "utf8")

  assert.doesNotMatch(source, /from\s+["'](?:node:)?crypto["']/)
  assert.doesNotMatch(source, /\bBuffer\b/)
})
