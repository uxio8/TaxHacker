import { readFile } from "node:fs/promises"
import path from "node:path"

function parseEnvLine(line) {
  const trimmedLine = line.trim()

  if (!trimmedLine || trimmedLine.startsWith("#")) {
    return null
  }

  const separatorIndex = trimmedLine.indexOf("=")
  if (separatorIndex <= 0) {
    return null
  }

  const key = trimmedLine.slice(0, separatorIndex).trim()
  let value = trimmedLine.slice(separatorIndex + 1).trim()

  if (
    (value.startsWith("\"") && value.endsWith("\""))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1)
  }

  return [key, value]
}

async function readEnvFile(filePath) {
  try {
    const source = await readFile(filePath, "utf8")
    return source
      .split(/\r?\n/u)
      .map(parseEnvLine)
      .filter(Boolean)
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return []
    }

    throw error
  }
}

export async function loadCriticalEnv(rootDir, baseEnv = process.env) {
  const env = {
    ...baseEnv,
  }
  const explicitKeys = new Set(
    Object.entries(baseEnv)
      .filter((entry) => entry[1] != null && entry[1] !== "")
      .map(([key]) => key)
  )

  for (const fileName of [".env", ".env.localdeploy", ".env.tunnel"]) {
    const entries = await readEnvFile(path.join(rootDir, fileName))

    for (const [key, value] of entries) {
      if (!explicitKeys.has(key)) {
        env[key] = value
      }
    }
  }

  return env
}
