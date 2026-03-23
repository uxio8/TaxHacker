import assert from "node:assert/strict"
import test from "node:test"
import { access, constants, mkdir, mkdtemp, rm, writeFile } from "fs/promises"
import os from "os"
import path from "path"

function getTransactionFileUploadPath(filename, transaction) {
  const year = transaction.issuedAt.getFullYear()
  const month = String(transaction.issuedAt.getMonth() + 1).padStart(2, "0")
  return `organizations/org-1/uploads/transactions/file-1/${year}/${month}/${filename}`
}

async function resolveTransactionFileDestination(organizationId, fileId, userUploadsDirectory, storedFilename, transaction) {
  let filename = storedFilename
  let relativePath = getTransactionFileUploadPath(filename, transaction)
  let collisionIndex = 1

  while (await fileExists(path.join(userUploadsDirectory, relativePath))) {
    filename = addFilenameSuffix(storedFilename, collisionIndex)
    relativePath = getTransactionFileUploadPath(filename, transaction)
    collisionIndex += 1
  }

  return { filename, path: relativePath }
}

async function fileExists(filePath) {
  try {
    await access(filePath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

function addFilenameSuffix(filename, suffix) {
  const extension = path.extname(filename)
  const baseName = path.basename(filename, extension)
  return `${baseName}-${suffix}${extension}`
}

const transaction = {
  issuedAt: new Date("2026-03-05T10:00:00.000Z"),
}

test("resolveTransactionFileDestination keeps the pretty name when there is no collision", async () => {
  const userUploadsDirectory = await mkdtemp(path.join(os.tmpdir(), "ledgerflow-"))

  try {
    const result = await resolveTransactionFileDestination(
      "org-1",
      "file-1",
      userUploadsDirectory,
      "F-2026-001 (2026-03-05) ACME.pdf",
      transaction
    )

    assert.equal(result.filename, "F-2026-001 (2026-03-05) ACME.pdf")
    assert.equal(
      result.path,
      "organizations/org-1/uploads/transactions/file-1/2026/03/F-2026-001 (2026-03-05) ACME.pdf"
    )
  } finally {
    await rm(userUploadsDirectory, { recursive: true, force: true })
  }
})

test("resolveTransactionFileDestination adds a suffix when the final file already exists", async () => {
  const userUploadsDirectory = await mkdtemp(path.join(os.tmpdir(), "ledgerflow-"))

  try {
    const storedFilename = "F-2026-001 (2026-03-05) ACME.pdf"
    const collisionPath = path.join(
      userUploadsDirectory,
      "organizations/org-1/uploads/transactions/file-1/2026/03/F-2026-001 (2026-03-05) ACME.pdf"
    )
    await mkdir(path.dirname(collisionPath), { recursive: true })
    await writeFile(collisionPath, "occupied")

    const result = await resolveTransactionFileDestination("org-1", "file-1", userUploadsDirectory, storedFilename, transaction)

    assert.equal(result.filename, "F-2026-001 (2026-03-05) ACME-1.pdf")
    assert.equal(
      result.path,
      "organizations/org-1/uploads/transactions/file-1/2026/03/F-2026-001 (2026-03-05) ACME-1.pdf"
    )
  } finally {
    await rm(userUploadsDirectory, { recursive: true, force: true })
  }
})
