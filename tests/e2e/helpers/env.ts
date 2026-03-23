import { readFileSync } from "node:fs"
import path from "node:path"

function stripWrappingQuotes(value: string) {
  if (
    (value.startsWith("\"") && value.endsWith("\""))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}

function readLocalEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env")
  const content = readFileSync(envPath, "utf8")
  const entries = new Map<string, string>()

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()

    if (!line || line.startsWith("#")) {
      continue
    }

    const separatorIndex = line.indexOf("=")
    if (separatorIndex <= 0) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    const value = stripWrappingQuotes(line.slice(separatorIndex + 1).trim())
    entries.set(key, value)
  }

  return entries
}

export function getLocalEnvValue(key: string) {
  return process.env[key] ?? readLocalEnvFile().get(key) ?? null
}

export function requireLocalEnvValue(key: string) {
  const value = getLocalEnvValue(key)

  if (!value) {
    throw new Error(`Falta ${key} en el entorno local para la smoke suite fiscal.`)
  }

  return value
}
