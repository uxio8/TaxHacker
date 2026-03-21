import assert from "node:assert/strict"
import test from "node:test"

import { createTranslator, getI18nConfig, t } from "./core.ts"
import { DEFAULT_LOCALE } from "./messages.ts"

test("getI18nConfig uses es-ES as the default locale", () => {
  const i18n = getI18nConfig()

  assert.equal(i18n.locale, DEFAULT_LOCALE)
})

test("t falls back to the english catalog when the active locale misses a key", () => {
  const translated = t("common.feedback.processing", {
    locale: "es-ES",
    messages: {
      "common.actions.cancel": "Cancelar",
    },
  })

  assert.equal(translated, "Processing...")
})

test("createTranslator interpolates replacement values", () => {
  const translate = createTranslator()

  assert.equal(translate("common.feedback.welcome", { name: "Lucia" }), "Bienvenida, Lucia")
})

test("t devuelve las traducciones de Ajustes añadidas al catálogo", () => {
  assert.equal(t("settings.crud.addNew"), "Añadir nuevo")
  assert.equal(t("settings.backups.downloadTitle"), "Descargar copia de seguridad")
  assert.equal(t("settings.subscription.currentPlan"), "Plan actual")
})

test("t devuelve las traducciones nuevas de auth, dashboard, import/export y archivos", () => {
  assert.equal(t("auth.login.enter"), "Entrar")
  assert.equal(t("dashboard.stats.overview"), "Resumen")
  assert.equal(t("import.csv.uploadPrompt"), "Sube tu archivo CSV para importar transacciones")
  assert.equal(t("export.transactions.title", { values: { total: 3 } }), "Exportar 3 transacciones")
  assert.equal(t("files.upload.errorTitle"), "Error al subir archivos")
  assert.equal(t("globalError.goHome"), "Ir al inicio")
})
