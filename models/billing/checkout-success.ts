type StripeCheckoutSuccessSession = {
  metadata?: {
    organizationId?: string | null
  } | null
  client_reference_id?: string | null
}

export function resolveStripeCheckoutSessionOrganizationId(session: StripeCheckoutSuccessSession) {
  return session.metadata?.organizationId || session.client_reference_id || null
}

export function shouldSyncStripeCheckoutSuccess(
  session: StripeCheckoutSuccessSession,
  currentOrganizationId: string
) {
  const sessionOrganizationId = resolveStripeCheckoutSessionOrganizationId(session)
  return sessionOrganizationId !== null && sessionOrganizationId === currentOrganizationId
}
