import assert from "node:assert/strict"
import test from "node:test"

import { Prisma } from "../../../prisma/client/index.js"
import {
  FiscalStorageNotReadyError,
  toFiscalStorageNotReadyError,
} from "../../../models/fiscal/storage.ts"

test("toFiscalStorageNotReadyError normaliza P2021 de tablas fiscales", () => {
  const error = new Prisma.PrismaClientKnownRequestError("tabla ausente", {
    code: "P2021",
    clientVersion: "test",
    meta: {
      table: "public.fiscal_profiles",
    },
  })

  const normalized = toFiscalStorageNotReadyError(error)

  assert.ok(normalized instanceof FiscalStorageNotReadyError)
  assert.match(normalized.message, /modulo fiscal/i)
})

test("toFiscalStorageNotReadyError ignora tablas ajenas al modulo fiscal", () => {
  const error = new Prisma.PrismaClientKnownRequestError("tabla ausente", {
    code: "P2021",
    clientVersion: "test",
    meta: {
      table: "public.users",
    },
  })

  assert.equal(toFiscalStorageNotReadyError(error), null)
})
