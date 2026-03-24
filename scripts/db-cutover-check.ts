import { existsSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { pathToFileURL } from "node:url"

type CheckStatus = "pass" | "fail"

type CutoverCheck = {
  id: string
  label: string
  status: CheckStatus
  detail: string
}

type DatabaseTarget = {
  label: "local" | "managed"
  url: string
}

type DatabaseProbeResult = {
  ok: boolean
  detail: string
}

type BuildDbCutoverCheckReportInput = {
  databaseUrl: string
  managedDatabaseUrl: string
}

type RunDbCutoverCheckOptions = BuildDbCutoverCheckReportInput & {
  skipConnectivity?: boolean
}

type RunDbCutoverCheckDependencies = {
  hasCommand: (command: string) => Promise<boolean>
  probeDatabase: (target: DatabaseTarget) => Promise<DatabaseProbeResult>
}

type DbUrlInfo = {
  url: URL
  hostname: string
  database: string
}

export type DbCutoverCheckReport = {
  ok: boolean
  checks: CutoverCheck[]
}

const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "postgres"])
const REQUIRED_COMMANDS = ["pg_dump", "pg_restore", "pg_isready"] as const

function parseDbUrl(value: string): DbUrlInfo | null {
  try {
    const url = new URL(value)
    const database = url.pathname.replace(/^\/+/, "").trim()

    if (database.length === 0) {
      return null
    }

    return {
      url,
      hostname: url.hostname,
      database,
    }
  } catch {
    return null
  }
}

function hasExplicitTls(url: URL) {
  const sslmode = url.searchParams.get("sslmode")
  const ssl = url.searchParams.get("ssl")

  return (
    sslmode === "require" ||
    sslmode === "verify-ca" ||
    sslmode === "verify-full" ||
    ssl === "true" ||
    ssl === "1"
  )
}

function makeCheck(id: string, label: string, status: CheckStatus, detail: string): CutoverCheck {
  return { id, label, status, detail }
}

export function buildDbCutoverCheckReport(
  input: BuildDbCutoverCheckReportInput
): DbCutoverCheckReport {
  const checks: CutoverCheck[] = []
  const databaseUrl = input.databaseUrl.trim()
  const managedDatabaseUrl = input.managedDatabaseUrl.trim()

  checks.push(
    makeCheck(
      "database-url-present",
      "DATABASE_URL presente",
      databaseUrl.length > 0 ? "pass" : "fail",
      databaseUrl.length > 0 ? "Origen local detectado" : "Falta DATABASE_URL"
    )
  )

  checks.push(
    makeCheck(
      "managed-url-present",
      "MANAGED_DATABASE_URL presente",
      managedDatabaseUrl.length > 0 ? "pass" : "fail",
      managedDatabaseUrl.length > 0
        ? "Destino gestionado detectado"
        : "Falta MANAGED_DATABASE_URL"
    )
  )

  const localInfo = databaseUrl.length > 0 ? parseDbUrl(databaseUrl) : null
  const managedInfo = managedDatabaseUrl.length > 0 ? parseDbUrl(managedDatabaseUrl) : null

  checks.push(
    makeCheck(
      "database-url-valid",
      "DATABASE_URL válida",
      localInfo ? "pass" : "fail",
      localInfo ? `Base local: ${localInfo.database}@${localInfo.hostname}` : "URL local inválida"
    )
  )

  checks.push(
    makeCheck(
      "managed-url-valid",
      "MANAGED_DATABASE_URL válida",
      managedInfo ? "pass" : "fail",
      managedInfo
        ? `Base gestionada: ${managedInfo.database}@${managedInfo.hostname}`
        : "URL gestionada inválida"
    )
  )

  const targetsAreDistinct =
    localInfo !== null &&
    managedInfo !== null &&
    localInfo.url.toString() !== managedInfo.url.toString()

  checks.push(
    makeCheck(
      "targets-are-distinct",
      "Origen y destino son distintos",
      targetsAreDistinct ? "pass" : "fail",
      targetsAreDistinct ? "Se detectan endpoints distintos" : "Origen y destino coinciden"
    )
  )

  const managedLooksRemote = managedInfo !== null && !LOCAL_DATABASE_HOSTS.has(managedInfo.hostname)

  checks.push(
    makeCheck(
      "managed-target-looks-remote",
      "El destino no parece local",
      managedLooksRemote ? "pass" : "fail",
      managedLooksRemote
        ? `Host gestionado: ${managedInfo?.hostname ?? ""}`
        : "El host gestionado sigue pareciendo local o del compose"
    )
  )

  const managedUsesTls = managedInfo !== null && hasExplicitTls(managedInfo.url)

  checks.push(
    makeCheck(
      "managed-url-uses-tls",
      "La base gestionada exige TLS",
      managedUsesTls ? "pass" : "fail",
      managedUsesTls ? "sslmode/ssl explícito detectado" : "Falta sslmode=require o equivalente"
    )
  )

  return {
    ok: checks.every((check) => check.status === "pass"),
    checks,
  }
}

async function defaultHasCommand(command: string) {
  const result = spawnSync("sh", ["-lc", `command -v ${command} >/dev/null 2>&1`], {
    stdio: "ignore",
  })
  return result.status === 0
}

async function defaultProbeDatabase(target: DatabaseTarget): Promise<DatabaseProbeResult> {
  const result = spawnSync("pg_isready", ["-d", target.url], {
    encoding: "utf8",
  })

  const output = [result.stdout, result.stderr].filter(Boolean).join(" ").trim()

  return {
    ok: result.status === 0,
    detail: output.length > 0 ? output : result.status === 0 ? "ok" : "sin respuesta",
  }
}

export async function runDbCutoverCheck(
  options: RunDbCutoverCheckOptions,
  dependencies: Partial<RunDbCutoverCheckDependencies> = {}
): Promise<DbCutoverCheckReport> {
  const report = buildDbCutoverCheckReport(options)
  const checks = [...report.checks]

  const hasCommand = dependencies.hasCommand ?? defaultHasCommand
  const probeDatabase = dependencies.probeDatabase ?? defaultProbeDatabase

  for (const command of REQUIRED_COMMANDS) {
    const available = await hasCommand(command)
    checks.push(
      makeCheck(
        `tool-${command}`,
        `Herramienta ${command} disponible`,
        available ? "pass" : "fail",
        available ? `${command} disponible en PATH` : `Falta ${command} en PATH`
      )
    )
  }

  if (!options.skipConnectivity) {
    for (const target of [
      { label: "local", url: options.databaseUrl },
      { label: "managed", url: options.managedDatabaseUrl },
    ] as const) {
      const probe = await probeDatabase(target)
      checks.push(
        makeCheck(
          `probe-${target.label}`,
          `Conectividad ${target.label}`,
          probe.ok ? "pass" : "fail",
          probe.detail
        )
      )
    }
  }

  return {
    ok: checks.every((check) => check.status === "pass"),
    checks,
  }
}

function parseCliArgs(argv: string[]) {
  const options = {
    databaseUrl: process.env.DATABASE_URL ?? "",
    managedDatabaseUrl: process.env.MANAGED_DATABASE_URL ?? "",
    skipConnectivity: false,
  }

  for (const arg of argv) {
    if (arg === "--skip-connectivity") {
      options.skipConnectivity = true
      continue
    }

    if (arg.startsWith("--database-url=")) {
      options.databaseUrl = arg.slice("--database-url=".length)
      continue
    }

    if (arg.startsWith("--managed-url=")) {
      options.managedDatabaseUrl = arg.slice("--managed-url=".length)
    }
  }

  return options
}

function printReport(report: DbCutoverCheckReport) {
  for (const check of report.checks) {
    const icon = check.status === "pass" ? "OK" : "FAIL"
    console.log(`${icon}  ${check.label}: ${check.detail}`)
  }
}

export function isExecutedAsScript(metaUrl: string, argvEntry: string | undefined) {
  if (!argvEntry) {
    return false
  }

  return metaUrl === pathToFileURL(argvEntry).href
}

async function main() {
  if (existsSync(".env.production")) {
    process.loadEnvFile(".env.production")
  } else if (existsSync(".env")) {
    process.loadEnvFile(".env")
  }

  const options = parseCliArgs(process.argv.slice(2))
  const report = await runDbCutoverCheck(options)
  printReport(report)

  if (!report.ok) {
    process.exitCode = 1
  }
}

if (isExecutedAsScript(import.meta.url, process.argv[1])) {
  main().catch((error) => {
    console.error("db-cutover-check crashed:", error)
    process.exitCode = 1
  })
}
