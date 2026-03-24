import assert from "node:assert/strict"
import test from "node:test"

import {
  buildBackupTimestamp,
  buildDockerComposeDumpArgs,
  buildLocalBackupPlan,
  findExpiredBackupDirectories,
} from "../../scripts/backup-local.ts"

test("buildBackupTimestamp genera un identificador estable y ordenable", () => {
  const timestamp = buildBackupTimestamp(new Date("2026-03-23T10:20:30.000Z"))

  assert.equal(timestamp, "20260323-102030")
})

test("buildLocalBackupPlan construye rutas para dump y data local", () => {
  const plan = buildLocalBackupPlan({
    now: new Date("2026-03-23T10:20:30.000Z"),
    backupRoot: "/srv/ledgerflow/backups",
    dataRoot: "/srv/ledgerflow/data",
    skipStorage: false,
  })

  assert.deepEqual(plan, {
    backupId: "20260323-102030",
    backupDir: "/srv/ledgerflow/backups/20260323-102030",
    databaseDumpPath: "/srv/ledgerflow/backups/20260323-102030/postgres.dump",
    manifestPath: "/srv/ledgerflow/backups/20260323-102030/manifest.json",
    storageSourceDir: "/srv/ledgerflow/data",
    storageTargetDir: "/srv/ledgerflow/backups/20260323-102030/data",
  })
})

test("buildDockerComposeDumpArgs genera el comando de dump para postgres en compose", () => {
  const args = buildDockerComposeDumpArgs({
    composeFile: "docker-compose.yml",
    envFile: ".env",
    postgresService: "postgres",
  })

  assert.deepEqual(args, [
    "compose",
    "--env-file",
    ".env",
    "-f",
    "docker-compose.yml",
    "exec",
    "-T",
    "postgres",
    "sh",
    "-lc",
    'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc',
  ])
})

test("findExpiredBackupDirectories detecta backups vencidos y mantiene los recientes", () => {
  const expired = findExpiredBackupDirectories({
    directoryNames: ["20260301-010101", "20260320-010101", "notes", "20260323-090000"],
    now: new Date("2026-03-23T10:00:00.000Z"),
    keepDays: 7,
  })

  assert.deepEqual(expired, ["20260301-010101"])
})
