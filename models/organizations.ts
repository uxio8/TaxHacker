import { randomUUID } from "node:crypto"

import { createOrganizationInvitation } from "./invitations.ts"
import type { Role } from "../prisma/client/index.js"

type OrganizationRecord = {
  id: string
  name: string
}

type OrganizationLookupUser = {
  id: string
  email: string
}

type OrganizationMembershipRecord = {
  role: string
  organization: OrganizationRecord
}

type OrganizationBootstrapUser = {
  id: string
  email: string
  name: string | null
  businessName: string | null
  defaultOrganizationId: string | null
}

type UserBootstrapSelect = {
  id: true
  email: true
  name: true
  businessName: true
  defaultOrganizationId: true
}

type OrganizationStoreTransaction = {
  user: {
    findUnique: (args: {
      where: {
        id?: string
        email?: string
      }
      select?: UserBootstrapSelect | {
        id: true
        email: true
      }
    }) => Promise<OrganizationBootstrapUser | OrganizationLookupUser | null>
    update: (args: {
      where: {
        id: string
      }
      data: {
        defaultOrganizationId: string
      }
    }) => Promise<unknown>
  }
  organization: {
    findUnique: (args: {
      where: {
        id: string
      }
    }) => Promise<OrganizationRecord | null>
    create: (args: {
      data: {
        id: string
        name: string
      }
    }) => Promise<OrganizationRecord>
    upsert: (args: {
      where: {
        id: string
      }
      update: {
        name: string
      }
      create: {
        id: string
        name: string
      }
      data?: never
    }) => Promise<OrganizationRecord>
  }
  membership: {
    findUnique: (args: {
      where: {
        userId_organizationId: {
          userId: string
          organizationId: string
        }
      }
    }) => Promise<{
      id: string
      userId: string
      organizationId: string
      role: string
    } | null>
    findMany: (args: {
      where: {
        userId: string
      }
      select: {
        role: true
        organization: {
          select: {
            id: true
            name: true
          }
        }
      }
      orderBy: {
        createdAt: "asc" | "desc"
      }
    }) => Promise<OrganizationMembershipRecord[]>
    upsert: (args: {
      where: {
        userId_organizationId: {
          userId: string
          organizationId: string
        }
      }
      update: {
        role: Role
      }
      create: {
        userId: string
        organizationId: string
        role: Role
      }
      data?: never
    }) => Promise<unknown>
  }
  organizationInvitation: {
    create: (args: {
      data: {
        organizationId: string
        email: string
        emailNormalized: string
        role: Role
        token: string
        invitedByUserId: string
        expiresAt: Date
      }
    }) => Promise<{
      token: string
    }>
  }
}

type OrganizationStore = OrganizationStoreTransaction & {
  $transaction?: <T>(callback: (tx: OrganizationStoreTransaction) => Promise<T>) => Promise<T>
}

type OrganizationDependencies = {
  listActiveSupportOrganizationsForUser?: (userId: string) => Promise<
    {
      id: string
      name: string
      mode: "read_only" | "read_write"
    }[]
  >
  hasActiveSupportAccess?: (input: {
    organizationId: string
    userId: string
  }) => Promise<boolean>
}

const USER_BOOTSTRAP_SELECT: UserBootstrapSelect = {
  id: true,
  email: true,
  name: true,
  businessName: true,
  defaultOrganizationId: true,
}

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

type CreateOrganizationForOpsInput = {
  name: string
  ownerEmail: string
  actorUserId: string
  initialUsers?: Array<{
    email: string
    role: Exclude<Role, "owner">
  }>
}

type CreateOrganizationForOpsResult = {
  organization: OrganizationRecord
  owner:
    | {
        type: "existing_user"
        userId: string
        email: string
      }
    | {
        type: "invited_email"
        email: string
        invitationToken: string
      }
  initialUsers: Array<
    | {
        type: "existing_user"
        userId: string
        email: string
        role: Exclude<Role, "owner">
      }
    | {
        type: "invited_email"
        email: string
        invitationToken: string
        role: Exclude<Role, "owner">
      }
  >
}

type CreateOrganizationForOpsOptions = {
  now?: Date
  idFactory?: () => string
  tokenFactory?: () => string
}

type ProvisionOrganizationAccessResult =
  | {
      type: "existing_user"
      userId: string
      email: string
      role: Role
    }
  | {
      type: "invited_email"
      email: string
      invitationToken: string
      role: Role
    }

async function resolveStore(store?: OrganizationStore): Promise<OrganizationStore> {
  if (store) {
    return store
  }

  const { prisma } = await import("../lib/db.ts")
  return prisma as unknown as OrganizationStore
}

async function resolveDependencies(
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
      : await import("./support-access.ts")

  return {
    listActiveSupportOrganizationsForUser:
      dependencies.listActiveSupportOrganizationsForUser ??
      supportModule?.listActiveSupportOrganizationsForUser ??
      (async () => []),
    hasActiveSupportAccess:
      dependencies.hasActiveSupportAccess ?? supportModule?.hasActiveSupportAccess ?? (async () => false),
  }
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

async function ensureDefaultOrganizationForUserWithStore(userId: string, store: OrganizationStore) {
  const user = await store.user.findUnique({
    where: { id: userId },
    select: USER_BOOTSTRAP_SELECT,
  }) as OrganizationBootstrapUser | null

  if (!user) {
    return null
  }

  if (user.defaultOrganizationId) {
    const existingOrganization = await store.organization.findUnique({
      where: { id: user.defaultOrganizationId },
    })

    if (existingOrganization) {
      await store.membership.upsert({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: existingOrganization.id,
          },
        },
        update: {
          role: "owner",
        },
        create: {
          userId: user.id,
          organizationId: existingOrganization.id,
          role: "owner",
        },
      })

      return existingOrganization
    }
  }

  const currentUser = await store.user.findUnique({
    where: { id: userId },
    select: USER_BOOTSTRAP_SELECT,
  }) as OrganizationBootstrapUser | null

  if (!currentUser) {
    return null
  }

  if (currentUser.defaultOrganizationId) {
    const existingOrganization = await store.organization.findUnique({
      where: { id: currentUser.defaultOrganizationId },
    })

    if (existingOrganization) {
      await store.membership.upsert({
        where: {
          userId_organizationId: {
            userId: currentUser.id,
            organizationId: existingOrganization.id,
          },
        },
        update: {
          role: "owner",
        },
        create: {
          userId: currentUser.id,
          organizationId: existingOrganization.id,
          role: "owner",
        },
      })

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

  await store.membership.upsert({
    where: {
      userId_organizationId: {
        userId: currentUser.id,
        organizationId: organization.id,
      },
    },
    update: {
      role: "owner",
    },
    create: {
      userId: currentUser.id,
      organizationId: organization.id,
      role: "owner",
    },
  })

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

async function createOrganizationForOpsWithStore(
  input: CreateOrganizationForOpsInput,
  store: OrganizationStore,
  options: CreateOrganizationForOpsOptions = {}
): Promise<CreateOrganizationForOpsResult> {
  const now = options.now ?? new Date()
  const organizationId = (options.idFactory ?? randomUUID)()
  const organizationName = input.name.trim()
  const ownerEmail = input.ownerEmail.trim().toLowerCase()
  const initialUsers = normalizeInitialUsers(input.initialUsers ?? [], ownerEmail)

  const organization = await store.organization.create({
    data: {
      id: organizationId,
      name: organizationName,
    },
  })

  const ownerAccess = await provisionOrganizationAccess(
    {
      organizationId: organization.id,
      email: ownerEmail,
      role: "owner",
      actorUserId: input.actorUserId,
    },
    {
      store,
      tokenFactory: options.tokenFactory,
      now,
    }
  )

  const createdInitialUsers: CreateOrganizationForOpsResult["initialUsers"] = []

  for (const initialUser of initialUsers) {
    const provisioned = await provisionOrganizationAccess(
      {
        organizationId: organization.id,
        email: initialUser.email,
        role: initialUser.role,
        actorUserId: input.actorUserId,
      },
      {
        store,
        tokenFactory: options.tokenFactory,
        now,
      }
    )

    if (provisioned.type === "existing_user") {
      createdInitialUsers.push({
        type: "existing_user",
        userId: provisioned.userId,
        email: provisioned.email,
        role: initialUser.role,
      })
      continue
    }

    createdInitialUsers.push({
      type: "invited_email",
      email: provisioned.email,
      invitationToken: provisioned.invitationToken,
      role: initialUser.role,
    })
  }

  return {
    organization,
    owner:
      ownerAccess.type === "existing_user"
        ? {
            type: "existing_user",
            userId: ownerAccess.userId,
            email: ownerAccess.email,
          }
        : {
            type: "invited_email",
            email: ownerAccess.email,
            invitationToken: ownerAccess.invitationToken,
          },
    initialUsers: createdInitialUsers,
  }
}

export async function createOrganizationForOps(
  input: CreateOrganizationForOpsInput,
  store?: OrganizationStore,
  options: CreateOrganizationForOpsOptions = {}
) {
  const db = await resolveStore(store)

  if (!store && db.$transaction) {
    return await db.$transaction(async (tx) => {
      return await createOrganizationForOpsWithStore(input, tx as OrganizationStore, options)
    })
  }

  return await createOrganizationForOpsWithStore(input, db, options)
}

export async function ensureOrganizationBootstrapForUser(userId: string, store?: OrganizationStore) {
  return await ensureDefaultOrganizationForUser(userId, store)
}

async function provisionOrganizationAccess(
  input: {
    organizationId: string
    email: string
    role: Role
    actorUserId: string
  },
  options: {
    store: OrganizationStore
    tokenFactory?: () => string
    now: Date
  }
): Promise<ProvisionOrganizationAccessResult> {
  const normalizedEmail = input.email.trim().toLowerCase()
  const user = await options.store.user.findUnique({
    where: {
      email: normalizedEmail,
    },
    select: {
      id: true,
      email: true,
    },
  }) as OrganizationLookupUser | null

  if (user) {
    await options.store.membership.upsert({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: input.organizationId,
        },
      },
      update: {
        role: input.role,
      },
      create: {
        userId: user.id,
        organizationId: input.organizationId,
        role: input.role,
      },
    })

    return {
      type: "existing_user",
      userId: user.id,
      email: user.email,
      role: input.role,
    }
  }

  const invitation = await createOrganizationInvitation(
    {
      organizationId: input.organizationId,
      email: normalizedEmail,
      role: input.role,
      invitedByUserId: input.actorUserId,
      expiresAt: new Date(options.now.getTime() + 1000 * 60 * 60 * 24 * 14),
    },
    {
      store: options.store as never,
      tokenFactory: options.tokenFactory,
      now: options.now,
    }
  )

  return {
    type: "invited_email",
    email: invitation.emailNormalized,
    invitationToken: invitation.token,
    role: input.role,
  }
}

function normalizeInitialUsers(
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
