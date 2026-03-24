import assert from "node:assert/strict"
import test from "node:test"

import {
  canAccessPlatformOps,
  ensurePlatformRoleAssignment,
  ensureSelfHostedPlatformOwner,
  hasPlatformRole,
  isPlatformRole,
  listPlatformRolesForUser,
  PLATFORM_ROLE,
} from "../../models/platform-admins.ts"

function createStore(assignments = []) {
  return {
    platformAdminAssignment: {
      findMany: async () => assignments,
    },
  }
}

test("isPlatformRole valida roles globales soportados", () => {
  assert.equal(isPlatformRole(PLATFORM_ROLE.OWNER), true)
  assert.equal(isPlatformRole("owner"), false)
})

test("listPlatformRolesForUser devuelve roles ordenados y hasPlatformRole los consulta", async () => {
  const store = createStore([
    { role: PLATFORM_ROLE.SUPPORT },
    { role: PLATFORM_ROLE.OWNER },
  ])

  const roles = await listPlatformRolesForUser("user-1", store)

  assert.deepEqual(roles, [PLATFORM_ROLE.SUPPORT, PLATFORM_ROLE.OWNER])
  assert.equal(await hasPlatformRole("user-1", PLATFORM_ROLE.OWNER, store), true)
  assert.equal(await hasPlatformRole("user-1", PLATFORM_ROLE.FINANCE, store), false)
  assert.equal(await canAccessPlatformOps("user-1", store), true)
  assert.equal(await canAccessPlatformOps("user-2", createStore([])), false)
})

test("listPlatformRolesForUser degrada a lista vacía si la tabla todavía no existe", async () => {
  const store = {
    platformAdminAssignment: {
      findMany: async () => {
        const error = new Error('The table public.platform_admin_assignments does not exist in the current database.')
        error.code = "P2021"
        throw error
      },
    },
  }

  assert.deepEqual(await listPlatformRolesForUser("user-1", store), [])
  assert.equal(await canAccessPlatformOps("user-1", store), false)
})

test("ensurePlatformRoleAssignment hace upsert y ensureSelfHostedPlatformOwner usa platform_owner", async () => {
  const calls = []
  const store = {
    platformAdminAssignment: {
      findMany: async () => [],
      upsert: async (args) => {
        calls.push(args)
        return { role: args.create.role }
      },
    },
  }

  assert.equal(await ensurePlatformRoleAssignment("user-1", PLATFORM_ROLE.ADMIN, store), true)
  assert.equal(await ensureSelfHostedPlatformOwner("user-2", store), true)
  assert.deepEqual(calls, [
    {
      where: {
        userId_role: {
          userId: "user-1",
          role: PLATFORM_ROLE.ADMIN,
        },
      },
      update: {},
      create: {
        userId: "user-1",
        role: PLATFORM_ROLE.ADMIN,
      },
    },
    {
      where: {
        userId_role: {
          userId: "user-2",
          role: PLATFORM_ROLE.OWNER,
        },
      },
      update: {},
      create: {
        userId: "user-2",
        role: PLATFORM_ROLE.OWNER,
      },
    },
  ])
})
