export function buildTransactionOwnedScope(organizationId: string) {
  return {
    organizationId,
  }
}

export function buildTransactionOwnedIdWhere(id: string, organizationId: string) {
  return {
    id_organizationId: {
      id,
      organizationId,
    },
  }
}

export function buildTransactionOwnedCreateData<T extends Record<string, unknown>>(
  userId: string,
  organizationId: string,
  data: T
) {
  return {
    ...data,
    userId,
    organizationId,
  }
}
