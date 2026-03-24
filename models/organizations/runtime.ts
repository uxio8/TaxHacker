import type { Role } from "../../prisma/client/index.js"
import type {
  CreateOrganizationForOpsInput,
  OrganizationDependencies,
  OrganizationStore,
} from "./types.ts"

export async function resolveStore(store?: OrganizationStore): Promise<OrganizationStore> {
  if (store) {
    return store
  }

  const { prisma } = await import("../../lib/db.ts")
  return prisma as unknown as OrganizationStore
}

export async function resolveDependencies(
  dependencies: OrganizationDependencies = {},
  options: {
    useFallbacks?: boolean
  } = {}
): Promise<Required<OrganizationDependencies>> {
  const useFallbacks = options.useFallbacks ?? true
  const supportModule =
    !useFallbacks ||
    (dependencies.listActiveSupportOrganizationsForUser && dependencies.hasActiveSupportAccess)
      ? null
      : await import("../support-access.ts")

  return {
    listActiveSupportOrganizationsForUser:
      dependencies.listActiveSupportOrganizationsForUser ??
      supportModule?.listActiveSupportOrganizationsForUser ??
      (async () => []),
    hasActiveSupportAccess:
      dependencies.hasActiveSupportAccess ?? supportModule?.hasActiveSupportAccess ?? (async () => false),
  }
}

export function normalizeInitialUsers(
  initialUsers: CreateOrganizationForOpsInput["initialUsers"],
  ownerEmail: string
): Array<{
  email: string
  role: Exclude<Role, "owner">
}> {
  const usersByEmail = new Map<string, { email: string; role: Exclude<Role, "owner"> }>()

  for (const initialUser of initialUsers ?? []) {
    const email = initialUser.email.trim().toLowerCase()

    if (!email || email === ownerEmail || usersByEmail.has(email)) {
      continue
    }

    if (initialUser.role !== "admin" && initialUser.role !== "member") {
      continue
    }

    usersByEmail.set(email, {
      email,
      role: initialUser.role,
    })
  }

  return Array.from(usersByEmail.values())
}
