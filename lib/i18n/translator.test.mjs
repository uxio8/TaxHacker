import assert from "node:assert/strict"
import test from "node:test"

import { createTranslator } from "./core.ts"

test("createTranslator devuelve el mensaje traducido", () => {
  const t = createTranslator({
    messages: {
      "common.home": "Inicio",
    },
  })

  assert.equal(t("common.home"), "Inicio")
})

test("createTranslator interpola variables en el mensaje", () => {
  const t = createTranslator({
    messages: {
      "unsorted.title": "Tienes {count} archivos sin revisar",
    },
  })

  assert.equal(t("unsorted.title", { count: 3 }), "Tienes 3 archivos sin revisar")
})

test("createTranslator devuelve la clave si falta la traducción", () => {
  const t = createTranslator({
    messages: {},
  })

  assert.equal(t("missing.key"), "missing.key")
})
