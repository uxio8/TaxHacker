import { pathToFileURL } from "node:url"

import { runOrganizationOwnerBackfill } from "../models/organization-owner-backfill.ts"

type CliOptions = {
  organizationNames: string[]
  dryRun: boolean
}

export function isExecutedAsScript(importMetaUrl: string, argv1: string | undefined) {
  if (!argv1) {
    return false
  }

  return pathToFileURL(argv1).href === importMetaUrl
}

export function parseCliOptions(argv: string[]): CliOptions {
  const organizationNames: string[] = []
  let dryRun = true

  for (const argument of argv) {
    if (argument === "--apply") {
      dryRun = false
      continue
    }

    if (argument === "--dry-run") {
      dryRun = true
      continue
    }

    organizationNames.push(argument)
  }

  return {
    organizationNames,
    dryRun,
  }
}

function printReport(report: Awaited<ReturnType<typeof runOrganizationOwnerBackfill>>) {
  console.log(`Organizaciones escaneadas: ${report.scanned}`)
  console.log(`Elegibles: ${report.eligible}`)
  console.log(`Backfilled: ${report.backfilled}`)
  console.log(`Saltadas: ${report.skipped}`)

  if (report.missingOrganizations.length > 0) {
    console.log(`No encontradas: ${report.missingOrganizations.join(", ")}`)
  }

  for (const result of report.results) {
    if (result.status === "backfilled") {
      console.log(`- ${result.organizationName}: owner ${result.email} -> ${result.userId}`)
      continue
    }

    if (result.status === "eligible_dry_run") {
      console.log(`- ${result.organizationName}: elegible (${result.email})`)
      continue
    }

    console.log(`- ${result.organizationName}: ${result.status}`)
  }
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2))

  if (options.organizationNames.length === 0) {
    throw new Error("Indica al menos una organización. Ejemplo: npm run ops:backfill-owners -- cuadrivo CUADRIVO2 --apply")
  }

  const report = await runOrganizationOwnerBackfill(options)
  printReport(report)
}

if (isExecutedAsScript(import.meta.url, process.argv[1])) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
