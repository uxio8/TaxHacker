import { BILLING_ADDONS, BILLING_PLANS } from "../../lib/billing/catalog.ts"
import { getOrganizationAccess } from "./access.ts"
import { getOrganizationContract } from "./contracts.ts"
import { listOrganizationUsage } from "./usage.ts"

export async function getOrganizationBillingSummary(organizationId: string) {
  const [contract, access, usageRows] = await Promise.all([
    getOrganizationContract(organizationId),
    getOrganizationAccess(organizationId),
    listOrganizationUsage(organizationId),
  ])

  const plan = BILLING_PLANS[access.plan.code] ?? null
  const addons = access.addonCodes
    .map((code) => BILLING_ADDONS[code])
    .filter((addon): addon is NonNullable<typeof addon> => Boolean(addon))

  return {
    contract,
    access,
    plan,
    addons,
    usageRows,
  }
}
