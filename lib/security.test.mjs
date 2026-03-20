import assert from "node:assert/strict"
import test from "node:test"

import {
  buildSelfHostedAccessCookieValue,
  hasSelfHostedAccess,
  normalizeBackupFilePath,
  resolvePathWithinBase,
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

test("normalizeBackupFilePath strips uploads prefix from safe paths", () => {
  assert.equal(normalizeBackupFilePath("/app/data/uploads/user@example.com/2025/03/file.pdf"), "2025/03/file.pdf")
})

test("normalizeBackupFilePath rejects traversal paths", () => {
  assert.throws(() => normalizeBackupFilePath("../../etc/passwd"), /Invalid backup file path/)
})

test("hasSelfHostedAccess accepts a valid signed cookie", () => {
  const secret = "0123456789abcdef0123456789abcdef"
  const token = "super-secret-token"
  const cookieValue = buildSelfHostedAccessCookieValue(token, secret)

  assert.equal(hasSelfHostedAccess(cookieValue, token, secret), true)
})

test("hasSelfHostedAccess rejects a tampered cookie", () => {
  const secret = "0123456789abcdef0123456789abcdef"
  const token = "super-secret-token"

  assert.equal(hasSelfHostedAccess("tampered", token, secret), false)
})
