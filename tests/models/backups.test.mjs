import assert from "node:assert/strict"
import test from "node:test"

import { MODEL_BACKUP, modelToJSON } from "../../models/backups.ts"

test("modelToJSON filtra por organizationId en el backup multitenant", async () => {
  let capturedArgs = null

  const json = await modelToJSON(
    {
      userId: "user-1",
      organizationId: "org-1",
    },
    {
      filename: "custom.json",
      model: {
        findMany: async (args) => {
          capturedArgs = args
          return [{ code: "vat", value: "21" }]
        },
      },
      backup: (_context, row) => row,
      restore: () => ({}),
    }
  )

  assert.deepEqual(capturedArgs, { where: { organizationId: "org-1" } })
  assert.equal(json, JSON.stringify([{ code: "vat", value: "21" }], null, 2))
})

test("restore de transactions conecta category y project por organizationId", async () => {
  const transactionBackup = MODEL_BACKUP.find((backup) => backup.filename === "transactions.json")

  assert.ok(transactionBackup)

  const restored = transactionBackup.restore(
    {
      userId: "user-1",
      organizationId: "org-1",
    },
    {
      id: "tx-1",
      name: "Factura",
      categoryCode: "software",
      projectCode: "cliente-a",
    }
  )

  assert.deepEqual(restored.category, {
    connect: {
      organizationId_code: {
        organizationId: "org-1",
        code: "software",
      },
    },
  })
  assert.deepEqual(restored.project, {
    connect: {
      organizationId_code: {
        organizationId: "org-1",
        code: "cliente-a",
      },
    },
  })
})
