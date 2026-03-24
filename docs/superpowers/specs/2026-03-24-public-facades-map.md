# Public Facades Map

## Scope

Task `0.3` del plan `compatibility-first-refactor`.

Objetivo: congelar los entrypoints públicos que ya usa el repo antes de partir internals. La regla es simple: primero se mantiene estable el módulo importado y luego, si hace falta, se trocea por dentro.

## Public Facades

### `models/attention.ts`

**Imports recomendados**

- `@/models/attention`

**Entrypoints públicos estables**

- `getAttentionSummary`
- `getNavigationAttentionSummary`
- `NavigationAttentionSummary`
- `RuntimeDependencies`
- `RuntimeInput`

**Se puede partir por dentro**

- runtime de atención
- normalización de señales
- adapters a workflow

**No debe cambiar aún**

- el módulo de import público
- los nombres de export
- el contrato de tipos ya consumido por `dashboard`, navegación y workflow

### `models/organizations.ts`

**Imports recomendados**

- `@/models/organizations`

**Entrypoints públicos estables**

- `buildDefaultOrganizationName`
- `getDefaultOrganizationForUser`
- `getOrganizationById`
- `ensureDefaultOrganizationForUser`
- `listOrganizationsForUser`
- `setCurrentOrganizationForUser`
- `createOrganizationForOps`
- `ensureOrganizationBootstrapForUser`

**Se puede partir por dentro**

- bootstrap de organización por usuario
- queries de membresías/acceso
- provisioning de `ops`
- helpers de invitaciones y normalización

**No debe cambiar aún**

- las firmas exportadas
- el hecho de que `models/organizations` sea el único punto público para bootstrap y acceso de organización

### `models/fiscal/legal-archive.ts`

**Imports recomendados**

- `@/models/fiscal/legal-archive`

**Entrypoints públicos estables**

- `LEGAL_ARCHIVE_MANIFEST_VERSION`
- `LEGAL_ARCHIVE_ATTACHMENT_STATUS`
- `buildLegalArchiveManifest`
- `listLegalArchivePeriods`
- `getLegalArchivePeriodDetail`
- tipos `LegalArchive*`

**Se puede partir por dentro**

- normalización de attachments
- construcción de manifest
- readers de periodos
- readers de filings

**No debe cambiar aún**

- el módulo público de archivo
- el shape de `LegalArchiveManifest`, `LegalArchivePeriodListItem` y `LegalArchivePeriodDetail`
- las funciones lectoras usadas por `archive`

### `models/workflow/read-api.ts`

**Imports recomendados**

- `@/models/workflow/read-api`

**Entrypoints públicos estables**

- `buildWorkflowItemsFromAttentionSummary`
- `buildWorkflowDocumentItemsFromUnsortedInbox`
- `buildWorkflowReadModelFromAttention`
- `isWorkflowPostureTerminal`

**Se puede partir por dentro**

- mapeadores de atención
- adapters de surfaces
- projectors y rebuild helpers

**No debe cambiar aún**

- el módulo público de adaptación genérica al workflow
- los contratos `WorkflowItem`/`WorkflowReadModel` consumidos por slices ya migrados

## Regla de evolución

Antes de mover internals:

1. mantener estable el import público
2. mover helpers privados a módulos internos nuevos
3. reexportar desde la fachada
4. actualizar esta spec solo cuando cambie el perímetro público de forma deliberada

La política por defecto es `split inside, keep facade stable`.
