import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

import {
  ALLOWED_APP_RAW_DATA_IMPORTS,
  ALLOWED_COMPONENT_APP_IMPORTS,
  ALLOWED_COMPONENT_FISCAL_VALUE_IMPORTERS,
  ALLOWED_LIB_COMPONENT_IMPORTS,
} from "./rules.mjs"
import { parseStaticModuleReferences } from "./parser.mjs"

const projectRoot = process.cwd()
const sourceFilePattern = /\.(?:[cm]?[jt]sx?)$/u

async function listFiles(rootDirectory) {
  const entries = await readdir(rootDirectory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const absolutePath = path.join(rootDirectory, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await listFiles(absolutePath)))
      continue
    }

    if (sourceFilePattern.test(entry.name)) {
      files.push(absolutePath)
    }
  }

  return files
}

async function collectImports(rootDirectory) {
  const files = await listFiles(path.join(projectRoot, rootDirectory))
  const imports = []

  for (const absolutePath of files) {
    const relativePath = path.relative(projectRoot, absolutePath)
    const source = await readFile(absolutePath, "utf8")

    for (const reference of parseStaticModuleReferences(source)) {
      imports.push({
        importer: relativePath,
        isTypeOnly: reference.isTypeOnly,
        specifier: reference.specifier,
      })
    }
  }

  return imports
}

function isUiSpecifier(specifier) {
  return (
    specifier.startsWith("@/components/")
    || specifier.includes("/components/")
    || specifier.startsWith("@/app/")
    || specifier.includes("/app/")
  )
}

function isAppSpecifier(specifier) {
  return specifier.startsWith("@/app/") || specifier.includes("/app/")
}

function isFiscalSpecifier(specifier) {
  return specifier.startsWith("@/models/fiscal/") || specifier.includes("/models/fiscal/")
}

function isRawDataSpecifier(specifier) {
  return specifier === "@/lib/db" || specifier === "@/prisma/client"
}

test("models no importan UI", async () => {
  const imports = await collectImports("models")
  const violations = imports.filter((entry) => isUiSpecifier(entry.specifier))

  assert.deepEqual(violations, [])
})

test("components no importan app y solo los surfaces fiscales permitidos hacen value-import fiscal", async () => {
  const imports = await collectImports("components")
  const appImports = imports
    .filter((entry) => isAppSpecifier(entry.specifier))
    .map((entry) => `${entry.importer} -> ${entry.specifier}`)
    .sort((left, right) => left.localeCompare(right))
  const fiscalValueViolations = imports.filter(
    (entry) =>
      isFiscalSpecifier(entry.specifier)
      && !entry.isTypeOnly
      && !ALLOWED_COMPONENT_FISCAL_VALUE_IMPORTERS.includes(entry.importer)
  )

  assert.deepEqual(appImports, ALLOWED_COMPONENT_APP_IMPORTS)
  assert.deepEqual(fiscalValueViolations, [])
})

test("lib no importa app ni components salvo los emails permitidos", async () => {
  const imports = await collectImports("lib")
  const violations = imports.filter((entry) => {
    if (!isUiSpecifier(entry.specifier)) {
      return false
    }

    return !ALLOWED_LIB_COMPONENT_IMPORTS.some(
      (allowed) => allowed.importer === entry.importer && allowed.specifier === entry.specifier
    )
  })

  assert.deepEqual(violations, [])
})

test("app mantiene congelada la allowlist actual de accesos crudos a db/prisma", async () => {
  const imports = await collectImports("app")
  const rawDataImports = imports
    .filter((entry) => isRawDataSpecifier(entry.specifier))
    .map((entry) => `${entry.importer} -> ${entry.specifier}`)
    .sort((left, right) => left.localeCompare(right))

  assert.deepEqual(rawDataImports, ALLOWED_APP_RAW_DATA_IMPORTS)
})
