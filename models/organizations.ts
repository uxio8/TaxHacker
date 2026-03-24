// Stable public facade for organization bootstrap, membership access and ops provisioning.
// Keep imports pointed at models/organizations while internals are split behind this file.

export {
  buildDefaultOrganizationName,
  buildDefaultUserNameFromEmail,
  ensureDefaultOrganizationForUser,
  ensureOrganizationBootstrapForUser,
  getDefaultOrganizationForUser,
  getOrganizationById,
  listOrganizationsForUser,
  setCurrentOrganizationForUser,
} from "./organizations/bootstrap.ts"

export { createOrganizationForOps } from "./organizations/ops.ts"
