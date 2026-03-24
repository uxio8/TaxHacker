import assert from "node:assert/strict"
import test from "node:test"

import {
  buildDbCutoverCheckReport,
  isExecutedAsScript,
  runDbCutoverCheck,
} from "../../scripts/db-cutover-check.ts"

test("buildDbCutoverCheckReport falla si falta la base gestionada", () => {
  const report = buildDbCutoverCheckReport({
    databaseUrl: "postgresql://user:pass@postgres:5432/ledgerflow",
    managedDatabaseUrl: "",
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find((check) => check.id === "managed-url-present")?.status, "fail")
})

test("buildDbCutoverCheckReport falla si origen y destino son el mismo", () => {
  const databaseUrl = "postgresql://user:pass@postgres:5432/ledgerflow"

  const report = buildDbCutoverCheckReport({
    databaseUrl,
    managedDatabaseUrl: databaseUrl,
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find((check) => check.id === "targets-are-distinct")?.status, "fail")
})

test("buildDbCutoverCheckReport exige TLS explícito en la base gestionada", () => {
  const report = buildDbCutoverCheckReport({
    databaseUrl: "postgresql://user:pass@postgres:5432/ledgerflow",
    managedDatabaseUrl: "postgresql://user:pass@managed.example.com:5432/ledgerflow",
  })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find((check) => check.id === "managed-url-uses-tls")?.status, "fail")
})

test("buildDbCutoverCheckReport pasa con dos targets distintos y TLS en la base gestionada", () => {
  const report = buildDbCutoverCheckReport({
    databaseUrl: "postgresql://user:pass@postgres:5432/ledgerflow",
    managedDatabaseUrl:
      "postgresql://user:pass@managed.example.com:5432/ledgerflow?sslmode=require",
  })

  assert.equal(report.ok, true)
  assert.equal(report.checks.every((check) => check.status === "pass"), true)
})

test("runDbCutoverCheck incorpora el estado de herramientas y sondas opcionales", async () => {
  const result = await runDbCutoverCheck(
    {
      databaseUrl: "postgresql://user:pass@postgres:5432/ledgerflow",
      managedDatabaseUrl:
        "postgresql://user:pass@managed.example.com:5432/ledgerflow?sslmode=require",
      skipConnectivity: false,
    },
    {
      hasCommand: async (command) => command !== "pg_restore",
      probeDatabase: async (target) => ({
        ok: target.label === "local",
        detail: target.label === "local" ? "accepting connections" : "timeout",
      }),
    }
  )

  assert.equal(result.ok, false)
  assert.equal(result.checks.find((check) => check.id === "tool-pg_dump")?.status, "pass")
  assert.equal(result.checks.find((check) => check.id === "tool-pg_restore")?.status, "fail")
  assert.equal(result.checks.find((check) => check.id === "probe-local")?.status, "pass")
  assert.equal(result.checks.find((check) => check.id === "probe-managed")?.status, "fail")
})

test("isExecutedAsScript resuelve bien rutas con espacios", () => {
  assert.equal(
    isExecutedAsScript(
      "file:///Users/test/Nuevos%20desarrollos/ledgerflow/scripts/db-cutover-check.ts",
      "/Users/test/Nuevos desarrollos/ledgerflow/scripts/db-cutover-check.ts"
    ),
    true
  )
})
