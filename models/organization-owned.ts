export function buildOrganizationOwnedScope(organizationId: string) {
  return {
    organizationId,
  }
}

export function buildOrganizationOwnedCodeWhere(organizationId: string, code: string) {
  return {
    organizationId_code: {
      organizationId,
      code,
    },
  }
}

export function buildOrganizationOwnedCreateData<T extends Record<string, unknown>>(organizationId: string, data: T) {
  return {
    organizationId,
    userId: organizationId,
    ...data,
  }
}
