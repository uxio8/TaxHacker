import type {
  OrganizationBootstrapUser,
  OrganizationDependencies,
  OrganizationStore,
  OrganizationStoreTransaction,
} from "./types.ts"
import { USER_BOOTSTRAP_SELECT } from "./types.ts"
import { resolveDependencies, resolveStore } from "./runtime.ts"

export function buildDefaultOrganizationName(user: {
  email: string
  name: string | null
  businessName: string | null
}) {
  const businessName = user.businessName?.trim()
  if (businessName) {
    return businessName
  }

  const name = user.name?.trim()
  if (name) {
    return name
  }

  const [emailLocalPart] = user.email.split("@")
  if (emailLocalPart?.trim()) {
    return emailLocalPart.trim()
  }

  return "Organization"
}

export function buildDefaultUserNameFromEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase()
  const [localPart] = normalizedEmail.split("@")

  if (localPart?.trim()) {
    return localPart.trim()
  }

  return normalizedEmail || "Owner"
}

export async function getDefaultOrganizationForUser(userId: string, store?: OrganizationStore) {
  const db = await resolveStore(store)
  const user = await db.user.findUnique({
    where: { id: userId },
    select: USER_BOOTSTRAP_SELECT,
  }) as OrganizationBootstrapUser | null

  if (!user?.defaultOrganizationId) {
    return null
  }

  return await db.organization.findUnique({
    where: { id: user.defaultOrganizationId },
  })
}

export async function getOrganizationById(organizationId: string, store?: OrganizationStore) {
  const db = await resolveStore(store)

  return await db.organization.findUnique({
    where: { id: organizationId },
  })
}

async function upsertOwnerMembership(store: OrganizationStoreTransaction, userId: string, organizationId: string) {
  await store.membership.upsert({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
    update: {
      role: "owner",
    },
    create: {
      userId,
      organizationId,
      role: "owner",
    },
  })
}

async function getUserBootstrap(store: OrganizationStoreTransaction, userId: string) {
  return await store.user.findUnique({
    where: { id: userId },
    select: USER_BOOTSTRAP_SELECT,
  }) as OrganizationBootstrapUser | null
}

async function ensureDefaultOrganizationForUserWithStore(userId: string, store: OrganizationStore) {
  const user = await getUserBootstrap(store, userId)

  if (!user) {
    return null
  }

  if (user.defaultOrganizationId) {
    const existingOrganization = await store.organization.findUnique({
      where: { id: user.defaultOrganizationId },
    })

    if (existingOrganization) {
      await upsertOwnerMembership(store, user.id, existingOrganization.id)
      return existingOrganization
    }
  }

  const currentUser = await getUserBootstrap(store, userId)
  if (!currentUser) {
    return null
  }

  if (currentUser.defaultOrganizationId) {
    const existingOrganization = await store.organization.findUnique({
      where: { id: currentUser.defaultOrganizationId },
    })

    if (existingOrganization) {
      await upsertOwnerMembership(store, currentUser.id, existingOrganization.id)
      return existingOrganization
    }
  }

  const organization = await store.organization.upsert({
    where: { id: currentUser.id },
    update: {
      name: buildDefaultOrganizationName(currentUser),
    },
    create: {
      id: currentUser.id,
      name: buildDefaultOrganizationName(currentUser),
    },
  })

  await upsertOwnerMembership(store, currentUser.id, organization.id)
  await store.user.update({
    where: { id: currentUser.id },
    data: {
      defaultOrganizationId: organization.id,
    },
  })

  return organization
}

export async function ensureDefaultOrganizationForUser(userId: string, store?: OrganizationStore) {
  const db = await resolveStore(store)

  if (!store && db.$transaction) {
    return await db.$transaction(async (tx) => {
      return await ensureDefaultOrganizationForUserWithStore(userId, tx as OrganizationStore)
    })
  }

  return await ensureDefaultOrganizationForUserWithStore(userId, db)
}

export async function listOrganizationsForUser(
  userId: string,
  store?: OrganizationStore,
  dependencies?: OrganizationDependencies
) {
  const db = await resolveStore(store)
  const runtime = await resolveDependencies(dependencies, {
    useFallbacks: !store,
  })
  const memberships = await db.membership.findMany({
    where: { userId },
    select: {
      role: true,
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  })

  const organizations = memberships.map((membership) => ({
    id: membership.organization.id,
    name: membership.organization.name,
    role: membership.role,
  }))

  const supportOrganizations = await runtime.listActiveSupportOrganizationsForUser(userId)
  const seenOrganizations = new Set(organizations.map((organization) => organization.id))

  for (const supportOrganization of supportOrganizations) {
    if (seenOrganizations.has(supportOrganization.id)) {
      continue
    }

    organizations.push({
      id: supportOrganization.id,
      name: supportOrganization.name,
      role: supportOrganization.mode === "read_write" ? "support_read_write" : "support_read_only",
    })
  }

  return organizations
}

export async function setCurrentOrganizationForUser(
  userId: string,
  organizationId: string,
  store?: OrganizationStore,
  dependencies?: OrganizationDependencies
) {
  const db = await resolveStore(store)
  const runtime = await resolveDependencies(dependencies, {
    useFallbacks: !store,
  })
  const membership = await db.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
  })

  if (!membership && !(await runtime.hasActiveSupportAccess({ userId, organizationId }))) {
    return false
  }

  await db.user.update({
    where: { id: userId },
    data: {
      defaultOrganizationId: organizationId,
    },
  })

  return true
}

export async function ensureOrganizationBootstrapForUser(userId: string, store?: OrganizationStore) {
  return await ensureDefaultOrganizationForUser(userId, store)
}
