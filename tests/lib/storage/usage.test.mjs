import assert from "node:assert/strict"
import path from "node:path"
import test from "node:test"

import {
  buildLegacyStorageUsageDirectories,
  buildStorageUsageDirectories,
} from "../../../lib/storage/usage.ts"

test("buildStorageUsageDirectories devuelve org + legacy durante la migracion", () => {
  const directories = buildStorageUsageDirectories({
    storageBasePath: "/app/uploads",
    organizationId: "org-1",
    legacyUserNamespaces: ["owner@example.com"],
  })

  assert.deepEqual(directories, [
    path.posix.normalize("/app/uploads/organizations/org-1"),
    path.posix.normalize("/app/uploads/owner@example.com"),
  ])
})

test("buildStorageUsageDirectories evita duplicados si el namespace coincide", () => {
  const directories = buildStorageUsageDirectories({
    storageBasePath: "/app/uploads",
    organizationId: "org-1",
    legacyUserNamespaces: ["organizations/org-1"],
  })

  assert.deepEqual(directories, [path.posix.normalize("/app/uploads/organizations/org-1")])
})

test("buildStorageUsageDirectories agrega varios namespaces legacy sin duplicados", () => {
  const directories = buildStorageUsageDirectories({
    storageBasePath: "/app/uploads",
    organizationId: "org-1",
    legacyUserNamespaces: ["owner@example.com", "member@example.com", "owner@example.com", "user-1"],
  })

  assert.deepEqual(directories, [
    path.posix.normalize("/app/uploads/organizations/org-1"),
    path.posix.normalize("/app/uploads/owner@example.com"),
    path.posix.normalize("/app/uploads/member@example.com"),
    path.posix.normalize("/app/uploads/user-1"),
  ])
})

test("buildLegacyStorageUsageDirectories devuelve solo namespaces legacy", () => {
  const directories = buildLegacyStorageUsageDirectories({
    storageBasePath: "/app/uploads",
    organizationId: "org-1",
    legacyUserNamespaces: ["owner@example.com", "organizations/org-1", "member@example.com"],
  })

  assert.deepEqual(directories, [
    path.posix.normalize("/app/uploads/owner@example.com"),
    path.posix.normalize("/app/uploads/member@example.com"),
  ])
})
