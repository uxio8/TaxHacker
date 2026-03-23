import { pathToFileURL } from "node:url"

type LegacyBillingUser = {
  id: string
  email: string
  defaultOrganizationId: string | null
  membershipPlan: string
  membershipExpiresAt: Date | null
  stripeCustomerId: string | null
  storageLimit: number
  storageUsed: number
  aiBalance: number
}

type BackfillOptions = {
  dryRun?: boolean
}

type BackfillReport = {
  scanned: number
  eligible: number
  bootstrapped: number
  skipped: number
}

type BackfillDependencies = {
  listUsers: () => Promise<LegacyBillingUser[]>
  ensureBillingBootstrap: (user: LegacyBillingUser, organizationId: string) => Promise<unknown>
}

function isEligibleUser(user: LegacyBillingUser) {
  return Boolean(user.defaultOrganizationId) && user.membershipPlan.trim() !== "" && user.membershipPlan !== "unlimited"
}

export async function runOrganizationBillingBackfill(
  options: BackfillOptions = {},
  dependencies?: Partial<BackfillDependencies>
): Promise<BackfillReport> {
  const runtime = await resolveDependencies(dependencies)
  const users = await runtime.listUsers()

  const report: BackfillReport = {
    scanned: users.length,
    eligible: 0,
    bootstrapped: 0,
    skipped: 0,
  }

  for (const user of users) {
    if (!isEligibleUser(user)) {
      report.skipped += 1
      continue
    }

    report.eligible += 1

    if (options.dryRun) {
      continue
    }

    await runtime.ensureBillingBootstrap(user, user.defaultOrganizationId as string)
    report.bootstrapped += 1
  }

  return report
}

function printReport(report: BackfillReport) {
  const lines = [
    `Usuarios escaneados: ${report.scanned}`,
    `Elegibles para backfill: ${report.eligible}`,
    `Bootstrapped: ${report.bootstrapped}`,
    `Saltados: ${report.skipped}`,
  ]

  console.log(lines.join("\n"))
}

async function resolveDependencies(
  dependencies?: Partial<BackfillDependencies>
): Promise<BackfillDependencies> {
  if (dependencies?.listUsers && dependencies.ensureBillingBootstrap) {
    return dependencies as BackfillDependencies
  }

  const [{ prisma }, billingBootstrapModule] = await Promise.all([
    import("../lib/db.ts"),
    import("../models/billing/bootstrap.ts"),
  ])

  return {
    listUsers:
      dependencies?.listUsers
      ?? (async () =>
        prisma.user.findMany({
          select: {
            id: true,
            email: true,
            defaultOrganizationId: true,
            membershipPlan: true,
            membershipExpiresAt: true,
            stripeCustomerId: true,
            storageLimit: true,
            storageUsed: true,
            aiBalance: true,
          },
        }) as Promise<LegacyBillingUser[]>),
    ensureBillingBootstrap:
      dependencies?.ensureBillingBootstrap ?? billingBootstrapModule.ensureOrganizationBillingBootstrapForUser,
  }
}

export function isExecutedAsScript(importMetaUrl: string, argv1: string | undefined) {
  if (!argv1) {
    return false
  }

  return pathToFileURL(argv1).href === importMetaUrl
}

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  const report = await runOrganizationBillingBackfill({ dryRun })
  printReport(report)
}

if (isExecutedAsScript(import.meta.url, process.argv[1])) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
