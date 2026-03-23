import { createWriteStream, existsSync } from "node:fs"
import { cp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { spawn } from "node:child_process"
import { pipeline } from "node:stream/promises"
import { pathToFileURL } from "node:url"

type BackupPlanInput = {
  now?: Date
  backupRoot: string
  dataRoot: string
  skipStorage: boolean
}

type BackupPlan = {
  backupId: string
  backupDir: string
  databaseDumpPath: string
  manifestPath: string
  storageSourceDir: string
  storageTargetDir: string
}

type DumpArgsInput = {
  composeFile: string
  envFile: string
  postgresService: string
}

type FindExpiredBackupDirectoriesInput = {
  directoryNames: string[]
  now?: Date
  keepDays: number
}

type RunLocalBackupOptions = {
  composeFile?: string
  envFile?: string
  postgresService?: string
  backupRoot?: string
  dataRoot?: string
  keepDays?: number
  skipStorage?: boolean
}

const BACKUP_NAME_PATTERN = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/

export function buildBackupTimestamp(date = new Date()) {
  const parts = [
    date.getUTCFullYear().toString().padStart(4, "0"),
    (date.getUTCMonth() + 1).toString().padStart(2, "0"),
    date.getUTCDate().toString().padStart(2, "0"),
    "-",
    date.getUTCHours().toString().padStart(2, "0"),
    date.getUTCMinutes().toString().padStart(2, "0"),
    date.getUTCSeconds().toString().padStart(2, "0"),
  ]

  return parts.join("")
}

export function buildLocalBackupPlan(input: BackupPlanInput): BackupPlan {
  const backupId = buildBackupTimestamp(input.now ?? new Date())
  const backupDir = path.join(input.backupRoot, backupId)

  return {
    backupId,
    backupDir,
    databaseDumpPath: path.join(backupDir, "postgres.dump"),
    manifestPath: path.join(backupDir, "manifest.json"),
    storageSourceDir: input.dataRoot,
    storageTargetDir: path.join(backupDir, "data"),
  }
}

export function buildDockerComposeDumpArgs(input: DumpArgsInput) {
  return [
    "compose",
    "--env-file",
    input.envFile,
    "-f",
    input.composeFile,
    "exec",
    "-T",
    input.postgresService,
    "sh",
    "-lc",
    'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc',
  ]
}

function parseBackupDirectoryTimestamp(directoryName: string) {
  const match = BACKUP_NAME_PATTERN.exec(directoryName)

  if (!match) {
    return null
  }

  const [, year, month, day, hour, minute, second] = match
  const timestamp = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  )

  return Number.isFinite(timestamp) ? timestamp : null
}

export function findExpiredBackupDirectories(input: FindExpiredBackupDirectoriesInput) {
  const now = input.now ?? new Date()
  const maxAgeMs = input.keepDays * 24 * 60 * 60 * 1000

  return input.directoryNames.filter((directoryName) => {
    const createdAt = parseBackupDirectoryTimestamp(directoryName)

    if (createdAt === null) {
      return false
    }

    return now.getTime() - createdAt > maxAgeMs
  })
}

async function dumpDatabase(
  plan: BackupPlan,
  options: Required<Pick<RunLocalBackupOptions, "composeFile" | "envFile" | "postgresService">>
) {
  const args = buildDockerComposeDumpArgs(options)
  const child = spawn("docker", args, {
    stdio: ["ignore", "pipe", "pipe"],
  })

  const stderrChunks: Buffer[] = []
  child.stderr.on("data", (chunk: Buffer | string) => {
    stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  })

  const output = createWriteStream(plan.databaseDumpPath)
  await pipeline(child.stdout, output)

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.on("error", reject)
    child.on("close", (code) => resolve(code ?? 1))
  })

  if (exitCode !== 0) {
    throw new Error(
      `No se pudo generar el dump PostgreSQL: ${Buffer.concat(stderrChunks).toString("utf8").trim()}`
    )
  }
}

async function copyStorage(plan: BackupPlan) {
  if (!existsSync(plan.storageSourceDir)) {
    return {
      copied: false,
      reason: "storage-missing",
    }
  }

  await cp(plan.storageSourceDir, plan.storageTargetDir, {
    recursive: true,
    force: true,
  })

  return {
    copied: true,
    reason: "ok",
  }
}

async function pruneOldBackups(backupRoot: string, keepDays: number) {
  if (!existsSync(backupRoot)) {
    return []
  }

  const entries = await readdir(backupRoot, { withFileTypes: true })
  const expired = findExpiredBackupDirectories({
    directoryNames: entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name),
    keepDays,
  })

  for (const directoryName of expired) {
    await rm(path.join(backupRoot, directoryName), { recursive: true, force: true })
  }

  return expired
}

function parseCliArgs(argv: string[]): Required<RunLocalBackupOptions> {
  const options: Required<RunLocalBackupOptions> = {
    composeFile: "docker-compose.yml",
    envFile: ".env",
    postgresService: "postgres",
    backupRoot: path.resolve("backups/local"),
    dataRoot: path.resolve("data"),
    keepDays: 7,
    skipStorage: false,
  }

  for (const arg of argv) {
    if (arg === "--skip-storage") {
      options.skipStorage = true
      continue
    }

    if (arg.startsWith("--compose-file=")) {
      options.composeFile = arg.slice("--compose-file=".length)
      continue
    }

    if (arg.startsWith("--env-file=")) {
      options.envFile = arg.slice("--env-file=".length)
      continue
    }

    if (arg.startsWith("--postgres-service=")) {
      options.postgresService = arg.slice("--postgres-service=".length)
      continue
    }

    if (arg.startsWith("--backup-root=")) {
      options.backupRoot = path.resolve(arg.slice("--backup-root=".length))
      continue
    }

    if (arg.startsWith("--data-root=")) {
      options.dataRoot = path.resolve(arg.slice("--data-root=".length))
      continue
    }

    if (arg.startsWith("--keep-days=")) {
      options.keepDays = Number(arg.slice("--keep-days=".length))
    }
  }

  return options
}

export async function runLocalBackup(rawOptions: RunLocalBackupOptions = {}) {
  const options = {
    composeFile: rawOptions.composeFile ?? "docker-compose.yml",
    envFile: rawOptions.envFile ?? ".env",
    postgresService: rawOptions.postgresService ?? "postgres",
    backupRoot: path.resolve(rawOptions.backupRoot ?? "backups/local"),
    dataRoot: path.resolve(rawOptions.dataRoot ?? "data"),
    keepDays: rawOptions.keepDays ?? 7,
    skipStorage: rawOptions.skipStorage ?? false,
  }

  const plan = buildLocalBackupPlan({
    backupRoot: options.backupRoot,
    dataRoot: options.dataRoot,
    skipStorage: options.skipStorage,
  })

  await mkdir(plan.backupDir, { recursive: true })
  await dumpDatabase(plan, options)

  let storageResult: { copied: boolean; reason: string } | null = null

  if (!options.skipStorage) {
    storageResult = await copyStorage(plan)
  }

  const dumpStats = await stat(plan.databaseDumpPath)
  const pruned = await pruneOldBackups(options.backupRoot, options.keepDays)

  const manifest = {
    backupId: plan.backupId,
    createdAt: new Date().toISOString(),
    composeFile: options.composeFile,
    envFile: options.envFile,
    postgresService: options.postgresService,
    databaseDumpPath: path.basename(plan.databaseDumpPath),
    databaseDumpSize: dumpStats.size,
    storage: storageResult,
    keepDays: options.keepDays,
    pruned,
  }

  await writeFile(plan.manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8")

  return {
    plan,
    manifest,
  }
}

export function isExecutedAsScript(metaUrl: string, argvEntry: string | undefined) {
  if (!argvEntry) {
    return false
  }

  return metaUrl === pathToFileURL(argvEntry).href
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2))
  const result = await runLocalBackup(options)
  console.log(`Backup creado en ${result.plan.backupDir}`)
}

if (isExecutedAsScript(import.meta.url, process.argv[1])) {
  main().catch((error) => {
    console.error("backup-local crashed:", error)
    process.exitCode = 1
  })
}
