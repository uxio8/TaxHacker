import { pathToFileURL } from "node:url"

type ReleaseHealthPayload = {
  ok?: boolean
  version?: string
  buildSha?: string
  environment?: string
}

type ReleaseHealthCheckOptions = {
  url: string
  sha: string
}

type ReleaseHealthCheckResult = {
  ok: boolean
  detail: string
  payload?: ReleaseHealthPayload
}

type ReleaseHealthCheckDependencies = {
  fetchImpl: typeof fetch
}

export function parseReleaseHealthArgs(argv: string[]) {
  const options: Partial<ReleaseHealthCheckOptions> = {}

  for (const arg of argv) {
    if (arg.startsWith("--url=")) {
      options.url = arg.slice("--url=".length).trim()
      continue
    }

    if (arg.startsWith("--sha=")) {
      options.sha = arg.slice("--sha=".length).trim()
    }
  }

  if (!options.url) {
    throw new Error("Falta --url")
  }

  if (!options.sha) {
    throw new Error("Falta --sha")
  }

  return options as ReleaseHealthCheckOptions
}

export async function checkReleaseHealth(
  options: ReleaseHealthCheckOptions,
  dependencies: Partial<ReleaseHealthCheckDependencies> = {}
): Promise<ReleaseHealthCheckResult> {
  const fetchImpl = dependencies.fetchImpl ?? fetch
  const response = await fetchImpl(options.url, {
    headers: {
      accept: "application/json",
    },
  })

  if (response.status !== 200) {
    return {
      ok: false,
      detail: `Healthcheck devolvió status ${response.status}`,
    }
  }

  const payload = (await response.json()) as ReleaseHealthPayload

  if (payload.buildSha !== options.sha) {
    return {
      ok: false,
      detail: `buildSha esperado ${options.sha}, recibido ${payload.buildSha ?? "vacío"}`,
      payload,
    }
  }

  return {
    ok: true,
    detail: "Release verificada correctamente",
    payload,
  }
}

export function isExecutedAsScript(importMetaUrl: string, argvEntry: string | undefined) {
  if (!argvEntry) {
    return false
  }

  return importMetaUrl === pathToFileURL(argvEntry).href
}

async function main() {
  const options = parseReleaseHealthArgs(process.argv.slice(2))
  const result = await checkReleaseHealth(options)

  if (!result.ok) {
    console.error(`[release:check] ${result.detail}`)
    process.exitCode = 1
    return
  }

  console.log(`[release:check] ${result.detail}`)
}

if (isExecutedAsScript(import.meta.url, process.argv[1])) {
  await main()
}
