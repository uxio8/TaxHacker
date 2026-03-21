import assert from "node:assert/strict"
import test from "node:test"

import { createTranslator } from "./core.ts"
import { createPageMetadata } from "./metadata.ts"

test("createPageMetadata traduce título y descripción con el catálogo activo", () => {
  const metadata = createPageMetadata("transactions.title", {
    descriptionKey: "transactions.description",
  })

  assert.equal(metadata.title, "Transacciones")
  assert.equal(metadata.description, "Gestiona tus transacciones")
})

test("createPageMetadata permite crear metadata solo con título", () => {
  const metadata = createPageMetadata("dashboard.title")

  assert.equal(metadata.title, "Panel")
  assert.equal("description" in metadata, false)
})

test("las claves de metadata auth no incluyen la marca para evitar duplicados con el template global", () => {
  const t = createTranslator()

  assert.equal(t("auth.cloud.metadataTitle"), "Edición Cloud")
  assert.equal(t("auth.enter.metadataTitle"), "Iniciar sesión")
  assert.equal(t("auth.selfHosted.metadataTitle"), "Edición Self-Hosted")
})
