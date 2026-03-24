import type { Role } from "../../prisma/client/index.js"

export type OrganizationRecord = {
  id: string
  name: string
}

export type OrganizationLookupUser = {
  id: string
  email: string
}

export type OrganizationMembershipRecord = {
  role: string
  organization: OrganizationRecord
}

export type OrganizationBootstrapUser = {
  id: string
  email: string
  name: string | null
  businessName: string | null
  defaultOrganizationId: string | null
}

export type UserBootstrapSelect = {
  id: true
  email: true
  name: true
  businessName: true
  defaultOrganizationId: true
}

export type OrganizationStoreTransaction = {
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
    create: (args: {
      data: {
        email: string
        name: string
        defaultOrganizationId: string
      }
    }) => Promise<OrganizationLookupUser>
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

export type OrganizationStore = OrganizationStoreTransaction & {
  $transaction?: <T>(callback: (tx: OrganizationStoreTransaction) => Promise<T>) => Promise<T>
}

export type OrganizationDependencies = {
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

export const USER_BOOTSTRAP_SELECT: UserBootstrapSelect = {
  id: true,
  email: true,
  name: true,
  businessName: true,
  defaultOrganizationId: true,
}

export type CreateOrganizationForOpsInput = {
  name: string
  ownerEmail: string
  actorUserId: string
  initialUsers?: Array<{
    email: string
    role: Exclude<Role, "owner">
  }>
}

export type CreateOrganizationForOpsResult = {
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

export type CreateOrganizationForOpsOptions = {
  now?: Date
  idFactory?: () => string
  tokenFactory?: () => string
}

export type ProvisionOrganizationAccessResult =
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
